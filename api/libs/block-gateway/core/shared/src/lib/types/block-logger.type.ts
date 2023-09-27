import { QueueNames } from "../enums/queue-names.enum"
import { JobNames } from "../enums/job-names.enum"
import { Queue, Worker, Processor } from "bullmq"
import { database } from "@api/shared/database"
import { InferInsertModel } from "drizzle-orm"

export namespace TBlockLogger {
  export type TQueueName = QueueNames.BLOCK_LOGGER
  export type TJobName = JobNames.LOG_BLOCK
  export type TQueueOutput = void
  export type TQueueInput = InferInsertModel<
    typeof database.schema.invocationLog
  >[]
  export type TWorker = Worker<TQueueInput, TQueueOutput, TJobName>
  export type TQueue = Queue<TQueueInput, TQueueOutput, TJobName>
  export type TProcessor = Processor<TQueueInput, TQueueOutput, TJobName>
}
