package redistream

import (
	"context"
	"log"

	"github.com/redis/go-redis/v9"
)

type (
	Streamable interface {
		redis.Scripter
		XGroupCreateMkStream(ctx context.Context, stream string, group string, start string) *redis.StatusCmd
		XPendingExt(ctx context.Context, a *redis.XPendingExtArgs) *redis.XPendingExtCmd
		XReadGroup(ctx context.Context, a *redis.XReadGroupArgs) *redis.XStreamSliceCmd
		XAdd(ctx context.Context, args *redis.XAddArgs) *redis.StringCmd
	}

	SubscribeMetadata struct {
		Logger            *log.Logger
		ConsumerGroupName string
		ConsumerName      string
	}
)
