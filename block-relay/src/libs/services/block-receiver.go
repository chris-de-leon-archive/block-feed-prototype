package services

import (
	"block-relay/src/libs/common"
	"block-relay/src/libs/constants"
	"block-relay/src/libs/messaging"
	"block-relay/src/libs/sqlc"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"golang.org/x/sync/errgroup"
)

type (
	BlockReceiverOpts struct {
		BatchSize int32
		MaxWaitMs int
	}

	BlockReceiverParams struct {
		DatabaseConnPool *pgxpool.Pool
		RedisClient      *redis.Client
		Opts             BlockReceiverOpts
	}

	BlockReceiver struct {
		logger      *log.Logger
		dbConnPool  *pgxpool.Pool
		redisClient *redis.Client
		dbQueries   *sqlc.Queries
		opts        *BlockReceiverOpts
	}
)

// NOTE: only 1 replica of this service is needed - adding more than one is unnecessary and will cause performance issues
func NewBlockReceiver(params BlockReceiverParams) *BlockReceiver {
	return &BlockReceiver{
		logger:      log.New(os.Stdout, "[block-receiver] ", log.LstdFlags),
		dbConnPool:  params.DatabaseConnPool,
		redisClient: params.RedisClient,
		dbQueries:   sqlc.New(params.DatabaseConnPool),
		opts:        &params.Opts,
	}
}

func (service *BlockReceiver) Run(ctx context.Context) error {
	// Acquires a single connection that will purely be used for listening to postgres notifications
	conn, err := service.dbConnPool.Acquire(ctx)
	if err != nil {
		return err
	} else {
		service.logger.Println("Successfully acquired a connection from pool")
		defer conn.Release()
	}

	// Informs Postgres that we want to receive notifications on this connection
	_, err = conn.Exec(ctx, fmt.Sprintf("LISTEN \"%s\";", constants.POSTGRES_BLOCK_CHANNEL_NAME))
	if err != nil {
		return err
	} else {
		service.logger.Printf("Successfully listening to channel \"%s\"\n", constants.POSTGRES_BLOCK_CHANNEL_NAME)
		defer func() {
			_, err := conn.Exec(context.Background(), fmt.Sprintf("UNLISTEN \"%s\";", constants.POSTGRES_BLOCK_CHANNEL_NAME))
			if err != nil {
				common.LogError(service.logger, err)
			}
		}()
	}

	// Sets up a channel to receive postgres notifications
	pgNotifications := make(chan *pgconn.Notification)
	defer close(pgNotifications)

	// Creates an errgroup
	eg := new(errgroup.Group)

	// Listens for new postgres notifications in the background and adds them to the channel
	eg.Go(func() error {
		c := conn.Conn()
		for {
			select {
			case <-ctx.Done():
				return nil
			default:
				msg, err := c.WaitForNotification(ctx)
				if err != nil {
					return err
				} else {
					pgNotifications <- msg
				}
			}
		}
	})

	// Starts a go routine that continuously adds jobs to the stream once a postgres
	// notification is received or a timeout expires
	eg.Go(func() error {
		// Logs a starting message
		service.logger.Printf("Ready to add new jobs to stream using a batch size of %d\n", service.opts.BatchSize)

		// Processes the backlog immediately upon startup (if this is not here, then
		// the program will enter the for loop and wait unnecessarily for the timeout
		// to expire or a postgres notification to arrive before processing a new data)
		if err := service.addNewJobsToStream(ctx, nil); err != nil {
			return err
		}

		// Creates a timer
		timerDuration := time.Duration(service.opts.MaxWaitMs) * time.Millisecond
		timer := time.NewTimer(timerDuration)
		defer timer.Stop()

		// Repeatedly processes new data from the database once a notification is received
		// or the timeout expires
		for {
			// Suppose instead of a timer we used a 2-second ticker but it takes 3+ seconds
			// to perform processing. If the ticker activates while data is being processed,
			// then we'll immediately process the data again, which is not what we want.
			// Instead, we either want to wait for a new postgres notification to arrive or
			// wait another 2 seconds *from the time we finished processing the last postgres
			// notification* before trying to process the data again. With that in mind a
			// timer would be more appropriate here.
			timer.Reset(timerDuration)

			// Continuously process notifications until the context is cancelled
			select {
			case <-ctx.Done():
				return nil
			case n, ok := <-pgNotifications:
				if !ok {
					return nil
				}
				if err := service.addNewJobsToStream(ctx, n); err != nil {
					return err
				}
			case _, ok := <-timer.C:
				if !ok {
					return nil
				}
				if err := service.addNewJobsToStream(ctx, nil); err != nil {
					return err
				}
			}
		}
	})

	// Waits for the background workers to gracefully stop and returns any errors
	if err := eg.Wait(); err != nil {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}

func (service *BlockReceiver) addNewJobsToStream(ctx context.Context, n *pgconn.Notification) error {
	// Logs whether this method was triggered by a timeout or a PG notification
	if n == nil {
		service.logger.Println("Timeout expired - checking for new jobs")
	} else {
		service.logger.Printf("Received postgres notification on channel \"%s\" from process with PID \"%d\"\n", n.Channel, n.PID)
	}

	// Continuously processes jobs in batches until there are none left
	for i := 0; ; i++ {
		// Logs the iteration number
		service.logger.Printf("Iteration %d\n", i)

		// Fetches the ID of the last webhook job that was published to redis if one exists
		lastPublishedJobId, err := service.redisClient.Do(ctx, "GET", constants.JOB_CURSOR_KEY).Int64()
		switch {
		case errors.Is(err, redis.Nil):
			lastPublishedJobId = 0
		case err != nil:
			return err
		}

		// Job IDs are defined with the BIGSERIAL type in Postgres (which is an auto-increment
		// integer ID sequence whish starts from 1 not 0). This means job IDs of zero are not
		// valid and indicate that we haven't processed any data yet.
		if lastPublishedJobId == 0 {
			service.logger.Println("Last published job ID was not found - fetching a batch of jobs after ID \"0\"")
		} else {
			service.logger.Printf("Last published job ID was found - fetching a batch of jobs after ID \"%d\"\n", lastPublishedJobId)
		}

		// Queries a batch of jobs
		jobs, err := service.dbQueries.GetWebhookJobs(ctx, &sqlc.GetWebhookJobsParams{
			CursorID: lastPublishedJobId,
			Limit:    service.opts.BatchSize,
		})
		if err != nil {
			return err
		} else {
			service.logger.Printf("%d new job(s) detected\n", len(jobs))
		}

		// Exits early if there are no jobs to process
		if len(jobs) == 0 {
			return nil
		}

		// Prepares the new cursor value and rows for redis
		args := make([]any, len(jobs)+2)
		args[0] = strconv.FormatInt(lastPublishedJobId+int64(len(jobs)), 10)
		args[1] = messaging.GetDataField()
		for i, job := range jobs {
			args[i+2] = messaging.NewWebhookMsg(
				job.ID,
				job.WebhookID.String(),
				job.WebhookMaxRetries,
			)
		}

		// Updates the cursor and adds a batch of messages to the stream in one atomic operation
		s := redis.NewScript(`
      local cursor_name = KEYS[1]
      local stream_name = KEYS[2]
      local cursor_val = ARGV[1]
      local msg_data_field = ARGV[2]
      redis.call("SET", cursor_name, cursor_val)
      for i = 3, #ARGV do
        redis.call("XADD", stream_name, "*", msg_data_field, ARGV[i])
      end
    `)

		// Executes the script
		scriptResult := s.Run(ctx, service.redisClient,
			[]string{constants.JOB_CURSOR_KEY, constants.WEBHOOK_STREAM},
			args...,
		)
		if err := scriptResult.Err(); err != nil && !errors.Is(err, redis.Nil) {
			return err
		} else {
			service.logger.Printf("Successfully published a batch of %d job(s) to the stream\n", len(jobs))
		}
	}
}
