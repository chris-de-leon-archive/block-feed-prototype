package redicluster

import "fmt"

const (
	Namespace            = "block-feed"
	PendingSetKey        = "pending-set"
	LatestBlockHeightKey = "latest-block-height"
	WebhookPrefix        = "webhook"
)

func GetWebhookKey(shardNum int, webhookID string) string {
	return PrefixWithShardNum(shardNum, WithPrefix(WebhookPrefix, webhookID))
}

func GetStreamKey(shardNum int, name string) string {
	return PrefixWithShardNum(shardNum, name)
}

func GetPendingSetKey(shardNum int) string {
	return PrefixWithShardNum(shardNum, PendingSetKey)
}

func GetLatestBlockHeightKey(shardNum int) string {
	return PrefixWithShardNum(shardNum, LatestBlockHeightKey)
}

func PrefixWithShardNum(shardNum int, s string) string {
	return PrefixWithNamespace(WithPrefix(fmt.Sprintf("{s%d}", shardNum), s))
}

func PrefixWithNamespace(s string) string {
	return WithPrefix(Namespace, s)
}

func WithPrefix(prefix string, s string) string {
	return fmt.Sprintf("%s:%s", prefix, s)
}
