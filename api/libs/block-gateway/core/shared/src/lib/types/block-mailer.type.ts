import { QueueNames } from "../enums/queue-names.enum"
import { JobNames } from "../enums/job-names.enum"
import { TBlockLogger } from "./block-logger.type"
import { Queue, Worker, Processor } from "bullmq"
import { database } from "@api/shared/database"
import { InferSelectModel } from "drizzle-orm"

export namespace TBlockMailer {
  export type TQueueName = QueueNames.BLOCK_MAILER
  export type TJobName = JobNames.MAIL_BLOCK
  export type TQueueOutput = TBlockLogger.TChildValue
  export type TQueueInput = Readonly<{
    subscription: InferSelectModel<typeof database.schema.subscriptions>
    details: InferSelectModel<typeof database.schema.emailSubscriptions>
    payload: object
  }>
  export type TWorker = Worker<TQueueInput, TQueueOutput, TJobName>
  export type TQueue = Queue<TQueueInput, TQueueOutput, TJobName>
  export type TProcessor = Processor<TQueueInput, TQueueOutput, TJobName>
}
