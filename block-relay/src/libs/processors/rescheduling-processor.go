package processors

import (
	"block-relay/src/libs/constants"
	"block-relay/src/libs/messaging"
	"block-relay/src/libs/services"
	"block-relay/src/libs/sqlc"
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type (
	ReschedulingProcessorParams struct {
		DatabaseConnPool *pgxpool.Pool
		RedisClient      *redis.Client
	}

	ReschedulingProcessor struct {
		redisClient *redis.Client
		dbConnPool  *pgxpool.Pool
		dbQueries   *sqlc.Queries
	}
)

func NewReschedulingProcessor(params ReschedulingProcessorParams) services.IStreamProcessor {
	return &ReschedulingProcessor{
		dbConnPool:  params.DatabaseConnPool,
		dbQueries:   sqlc.New(params.DatabaseConnPool),
		redisClient: params.RedisClient,
	}
}

func (service *ReschedulingProcessor) ProcessMessage(ctx context.Context, msg redis.XMessage) error {
	// Converts the incoming stream data to a strongly typed struct
	msgData, err := messaging.ParseMessage[messaging.ReschedulingMsgData](msg)
	if err != nil {
		return err
	}

	// Converts the UUID string back to a UUID struct
	webhookId, err := uuid.Parse(msgData.WebhookID)
	if err != nil {
		return err
	}

	// Before running the transaction, we need to check if the job has been
	// already been recreated with a new ID and block data (aka rescheduled).
	// If the job has already been rescheduled, its ID in the database will
	// not match the ID we get back from the redis stream. As a result, we
	// can either test that the job ID we receive from the redis stream does
	// not exist in the database or find the job by its webhook ID instead of
	// its actual ID. The latter approach works because each webhook job has a
	// one-to-one relationship with its corresponding webhook in the database
	// and webhook IDs are static UUIDs. In this design we use the latter approach
	// since it is more reliable in the event that a webhook is deleted by the
	// user.
	dbJob, err := service.dbQueries.GetWebhookJobByWebhookID(ctx, webhookId)
	if errors.Is(err, pgx.ErrNoRows) {
		if err = service.ack(ctx, msg); err != nil {
			return err
		}
		return nil
	}
	if err != nil {
		return err
	}

	// If the job ID from the database matches the job ID in the redis stream
	// message, then the job has not been rescheduled yet and we can proceed
	// with running the transaction. If the job IDs are different, then the
	// job has already been rescheduled but we haven't ACKed the message in
	// which case we don't need to re-run this transaction.
	if dbJob.ID == msgData.JobID {
		if err := pgx.BeginFunc(ctx, service.dbConnPool, func(tx pgx.Tx) error {
			// Deletes the existing job, creates a new job with a new ID along with
			// updated block data, and cleans the block cache in a single query
			if _, err = service.dbQueries.WithTx(tx).RescheduleWebhookJob(ctx, &sqlc.RescheduleWebhookJobParams{
				ID:          msgData.JobID,
				BlockHeight: dbJob.BlockHeight + int64(msgData.BlocksSent),
			}); err != nil {
				return err
			} else {
				return nil
			}
		}); err != nil {
			return err
		}
	}

	// As noted above, if the job ID in the database does not match the job ID
	// from the stream, then this means we've already successfully committed the
	// transaction to the DB, but the program crashed before we could successfully
	// perform an XACK. In other words, the app crashed at this point in the code
	// after the transaction was committed to the database. In this case, we should
	// NOT re-run the transaction. The transaction itself is not idempotent and re-
	// running it will result in blocks being skipped. Instead, we should skip the
	// transaction and proceed to running the XACK. This will ensure that stream
	// processing is fully idempotent even though the queries in the transaction
	// are not inherently idempotent.

	// Marks this entry as completed
	if err = service.ack(ctx, msg); err != nil {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}

func (service *ReschedulingProcessor) ProcessFailedMessage(ctx context.Context, msg redis.XMessage) error {
	// TODO: if we're here, this most likely means we're having major database issues.
	// If we ACK without performing the database update, then the job will sit in the
	// database forever, the client will stop receiving webhook data, and the cached
	// blocks related to this job will never be evicted. If we return nil or an error,
	// the stream consumer will repeatedly process the same failed job, which prevents
	// this consumer from processing new data. Is there a better way to handle this
	// without manual intervention?
	return fmt.Errorf("non-recoverable error encountered for message: %v", msg)
}

func (service *ReschedulingProcessor) ack(ctx context.Context, msg redis.XMessage) error {
	// Acknowledges the job and deletes it from the stream in one atomic operation
	ackScript := redis.NewScript(`
    local stream_name = KEYS[1]
    local consumer_group = KEYS[2]
    local message_id = ARGV[1]
    redis.call("XACK", stream_name, consumer_group, message_id)
    redis.call("XDEL", stream_name, message_id)
  `)

	// Executes the script
	scriptResult := ackScript.Run(ctx, service.redisClient,
		[]string{constants.RESCHEDULER_STREAM, constants.RESCHEULER_CONSUMER_GROUP_NAME},
		msg.ID,
	)
	if err := scriptResult.Err(); err != nil && !errors.Is(err, redis.Nil) {
		return err
	}

	// Returns nil if no errors occurred
	return nil
}
