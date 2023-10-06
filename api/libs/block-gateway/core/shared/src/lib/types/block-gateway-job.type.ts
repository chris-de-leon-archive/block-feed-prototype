import { TBlockConsumer } from "./block-consumer.type"
import { TBlockDivider } from "./block-divider.type"
import { TBlockFetcher } from "./block-fetcher.type"
import { TBlockWebhook } from "./block-webhook.type"
import { TBlockMailer } from "./block-mailer.type"
import { TBlockLogger } from "./block-logger.type"
import { FlowChildJob, FlowJob } from "bullmq"

type T = Readonly<
  | {
      queueName: TBlockConsumer.TQueueName
      name: TBlockConsumer.TJobName
      data?: TBlockConsumer.TQueueInput
    }
  | {
      queueName: TBlockFetcher.TQueueName
      name: TBlockFetcher.TJobName
      data?: TBlockFetcher.TQueueInput
    }
  | {
      queueName: TBlockDivider.TQueueName
      name: TBlockDivider.TJobName
      data?: TBlockDivider.TQueueInput
    }
  | {
      queueName: TBlockLogger.TQueueName
      name: TBlockLogger.TJobName
      data?: TBlockLogger.TQueueInput
    }
  | {
      queueName: TBlockWebhook.TQueueName
      name: TBlockWebhook.TJobName
      data?: TBlockWebhook.TQueueInput
    }
  | {
      queueName: TBlockMailer.TQueueName
      name: TBlockMailer.TJobName
      data?: TBlockMailer.TQueueInput
    }
>

export type TBlockGatewayJob = T &
  Readonly<Omit<FlowJob, keyof T | "children">> &
  Readonly<{
    children?: (Omit<FlowChildJob, keyof T> & T)[]
  }>
