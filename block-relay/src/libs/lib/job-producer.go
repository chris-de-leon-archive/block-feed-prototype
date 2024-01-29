package lib

import (
	"block-relay/src/libs/common"
	"block-relay/src/libs/sqlc"
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type (
	JobProducerOpts struct {
		BatchSize int32
		MaxWaitMs int32
	}

	JobProducerParams struct {
		DatabaseConnPool *pgxpool.Pool
		RedisClient      *redis.Client
		Opts             JobProducerOpts
	}

	JobProducer struct {
		logger      *log.Logger
		dbConnPool  *pgxpool.Pool
		redisClient *redis.Client
		dbQueries   *sqlc.Queries
		opts        *JobProducerOpts
	}

	PgNotification struct {
		Notification *pgconn.Notification
		Err          error
	}
)

// NOTE: only 1 replica of this service is needed
// Adding more than one is unnecessary and will cause performance issues
func NewJobProducer(params JobProducerParams) *JobProducer {
	return &JobProducer{
		logger:      log.New(os.Stdout, "[job-producer] ", log.LstdFlags),
		dbConnPool:  params.DatabaseConnPool,
		redisClient: params.RedisClient,
		dbQueries:   sqlc.New(params.DatabaseConnPool),
		opts:        &params.Opts,
	}
}

func (service *JobProducer) Run(ctx context.Context) error {
	// Acquires a single connection that will purely be used for listening to postgres notifications
	conn, err := service.dbConnPool.Acquire(ctx)
	if err != nil {
		return err
	} else {
		service.logger.Println("Successfully acquired a connection from pool")
		defer conn.Release()
	}

	// Informs Postgres that we want to receive notifications on this connection
	_, err = conn.Exec(ctx, fmt.Sprintf("LISTEN \"%s\";", POSTGRES_WEBHOOK_JOB_CHANNEL_NAME))
	if err != nil {
		return err
	} else {
		service.logger.Printf("Successfully listening to channel \"%s\"\n", POSTGRES_WEBHOOK_JOB_CHANNEL_NAME)
		defer func() {
			_, err := conn.Exec(ctx, fmt.Sprintf("UNLISTEN \"%s\";", POSTGRES_WEBHOOK_JOB_CHANNEL_NAME))
			if err != nil {
				common.LogError(service.logger, err)
			}
		}()
	}

	// Sets up a channel to receive postgres notifications
	pgNotifications := make(chan PgNotification)
	defer close(pgNotifications)

	// Listens for new postgres notifications in the background and adds them to the channel
	go func() {
		c := conn.Conn()
		for {
			select {
			case <-ctx.Done():
				return
			default:
				msg, err := c.WaitForNotification(ctx)
				if ctx.Err() == nil {
					pgNotifications <- PgNotification{Notification: msg, Err: err}
				}
			}
		}
	}()

	// Sets up a timer for notification timeouts
	timer := time.NewTimer(time.Duration(service.opts.MaxWaitMs) * time.Millisecond)
	defer timer.Stop()

	// Only process jobs when a postgres notification arrives or if we have waited too long for a notification
	for {
		select {
		case n, ok := <-pgNotifications:
			if !ok {
				return nil
			}
			if err := service.processPendingJobs(ctx, &n); err != nil {
				common.LogError(service.logger, err)
			}
		case _, ok := <-timer.C:
			if !ok {
				return nil
			}
			if err := service.processPendingJobs(ctx, nil); err != nil {
				common.LogError(service.logger, err)
			}
		case <-ctx.Done():
			return nil
		}
	}
}

func (service *JobProducer) processPendingJobs(ctx context.Context, n *PgNotification) error {
	// Logs whether this method was triggered by a timeout or a PG notification
	if n == nil {
		service.logger.Println("Timeout expired - checking for new jobs")
	} else {
		service.logger.Printf("Received postgres notification on channel \"%s\" from process with PID \"%d\"\n", n.Notification.Channel, n.Notification.PID)
	}

	// If we received a non-nil PG notification, but there was an error then exit the function early
	if n != nil && n.Err != nil {
		service.logger.Println("Encountered non-recoverable error while listening for postgres notifications")
		return n.Err
	}

	// Continuously processes jobs in batches until there are none left
	for i := 0; ; i++ {
		// Logs the iteration number
		service.logger.Printf("Iteration %d\n", i)

		// Fetches the ID of the last webhook job that was published to redis if one exists
		lastPublishedJobId, err := service.redisClient.Do(ctx, "GET", REDIS_WEBHOOK_JOB_CURSOR_KEY).Int64()
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

		// Queries a batch of in progress jobs
		inprogJobs, err := service.dbQueries.FindWebhookJobsGreaterThanID(ctx, &sqlc.FindWebhookJobsGreaterThanIDParams{
			ID:    lastPublishedJobId,
			Limit: service.opts.BatchSize,
		})
		if err != nil {
			return err
		}

		// Exits early if there are no jobs to process
		service.logger.Printf("%d new job(s) detected\n", len(inprogJobs))
		if len(inprogJobs) == 0 {
			return nil
		}

		// JSON encodes the data
		messages := make([]string, len(inprogJobs))
		for i, job := range inprogJobs {
			msg, err := common.JsonStringify(job)
			if err != nil {
				return err
			}
			messages[i] = msg
		}

		// Updates the cursor and adds the messages to the stream using a single redis transaction
		err = service.redisClient.Watch(ctx, func(tx *redis.Tx) error {
			_, err := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
				err = pipe.Do(ctx, "SET", REDIS_WEBHOOK_JOB_CURSOR_KEY, lastPublishedJobId+int64(len(inprogJobs))).Err()
				if err != nil && !errors.Is(err, redis.Nil) {
					return err
				}
				for _, msg := range messages {
					err = pipe.Do(ctx, "XADD", REDIS_WEBHOOK_JOB_STREAM_NAME, "*", REDIS_WEBHOOK_JOB_STREAM_KEY, msg).Err()
					if err != nil && !errors.Is(err, redis.Nil) {
						return err
					}
				}
				return nil
			})
			return err
		}, REDIS_WEBHOOK_JOB_CURSOR_KEY, REDIS_WEBHOOK_JOB_STREAM_NAME)

		// Handles any transaction errors
		if err != nil && !errors.Is(err, redis.Nil) {
			return err
		} else {
			service.logger.Printf("Successfully published a batch of %d job(s) to the stream\n", len(inprogJobs))
		}
	}
}
