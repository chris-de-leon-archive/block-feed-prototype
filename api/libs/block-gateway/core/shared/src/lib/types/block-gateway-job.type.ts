import { TBlockConsumer } from "./block-consumer.type"
import { TBlockDivider } from "./block-divider.type"
import { TBlockFetcher } from "./block-fetcher.type"
import { TBlockLogger } from "./block-logger.type"
import { FlowJob } from "bullmq"

export type TBlockGatewayJob = Readonly<
  | {
      queueName: TBlockConsumer.TQueueName
      name: TBlockConsumer.TJobName
      data: TBlockConsumer.TQueueInput
    }
  | {
      queueName: TBlockFetcher.TQueueName
      name: TBlockFetcher.TJobName
      data: TBlockFetcher.TQueueInput
    }
  | {
      queueName: TBlockDivider.TQueueName
      name: TBlockDivider.TJobName
      data: TBlockDivider.TQueueInput
    }
  | {
      queueName: TBlockLogger.TQueueName
      name: TBlockLogger.TJobName
      data: TBlockLogger.TQueueInput
    }
> &
  Readonly<Omit<FlowJob, "queueName" | "name" | "data">>
