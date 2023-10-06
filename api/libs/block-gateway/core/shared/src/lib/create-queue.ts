import { TBlockConsumer } from "./types/block-consumer.type"
import { TBlockDivider } from "./types/block-divider.type"
import { TBlockWebhook } from "./types/block-webhook.type"
import { TBlockFetcher } from "./types/block-fetcher.type"
import { TBlockMailer } from "./types/block-mailer.type"
import { TBlockLogger } from "./types/block-logger.type"
import { QueueNames } from "./enums/queue-names.enum"
import { Queue } from "bullmq"

type InferQueue<T extends QueueNames> = T extends QueueNames.BLOCK_CONSUMER
  ? TBlockConsumer.TQueue
  : T extends QueueNames.BLOCK_LOGGER
  ? TBlockLogger.TQueue
  : T extends QueueNames.BLOCK_DIVIDER
  ? TBlockDivider.TQueue
  : T extends QueueNames.BLOCK_FETCHER
  ? TBlockFetcher.TQueue
  : T extends QueueNames.BLOCK_MAILER
  ? TBlockMailer.TQueue
  : T extends QueueNames.BLOCK_WEBHOOK
  ? TBlockWebhook.TQueue
  : Worker

export const createQueue = <T extends QueueNames>(url: URL, name: T) => {
  return new Queue(name, {
    connection: {
      host: url.hostname,
      port: Number(url.port),
      offlineQueue: false,
    },
  }).on("error", (err) => {
    console.error(`error: ${err}`)
  }) as InferQueue<T>
}
