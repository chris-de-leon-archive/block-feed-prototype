import { TBlockConsumer } from "./types/block-consumer.type"
import { TBlockDivider } from "./types/block-divider.type"
import { TBlockFetcher } from "./types/block-fetcher.type"
import { TBlockLogger } from "./types/block-logger.type"
import { QueueNames } from "./enums/queue-names.enum"
import { Processor, Worker } from "bullmq"

type InferProcessor<T extends QueueNames> = T extends QueueNames.BLOCK_CONSUMER
  ? TBlockConsumer.TProcessor
  : T extends QueueNames.BLOCK_LOGGER
  ? TBlockLogger.TProcessor
  : T extends QueueNames.BLOCK_DIVIDER
  ? TBlockDivider.TProcessor
  : T extends QueueNames.BLOCK_FETCHER
  ? TBlockFetcher.TProcessor
  : Processor

type InferWorker<T extends QueueNames> = T extends QueueNames.BLOCK_CONSUMER
  ? TBlockConsumer.TWorker
  : T extends QueueNames.BLOCK_LOGGER
  ? TBlockLogger.TWorker
  : T extends QueueNames.BLOCK_DIVIDER
  ? TBlockDivider.TWorker
  : T extends QueueNames.BLOCK_FETCHER
  ? TBlockFetcher.TWorker
  : Worker

export const createWorker = <T extends QueueNames>(
  url: URL,
  name: T,
  cb: InferProcessor<T>
) => {
  return new Worker(name, cb as Processor, {
    connection: {
      host: url.hostname,
      port: Number(url.port),
      offlineQueue: false,
    },
  })
    .on("ready", () => {
      console.log(`worker "${name}" is ready to process jobs`)
    })
    .on("error", (err) => {
      console.error(`error: ${err}`)
    })
    .on("stalled", (job, err) => {
      console.error(`stall: ${err}`)
    })
    .on("failed", (job, err) => {
      console.error(`fail: ${err}`)
    }) as InferWorker<T>
}
