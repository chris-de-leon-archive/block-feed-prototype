import { QueueNames } from "../enums/queue-names.enum"
import { JobNames } from "../enums/job-names.enum"
import { Queue, Worker, Processor } from "bullmq"

export namespace TBlockConsumer {
  export type TQueueName = QueueNames.BLOCK_CONSUMER
  export type TJobName = JobNames.CONSUME_BLOCK
  export type TQueueOutput = void
  export type TQueueInput<T = object> = Readonly<{
    cursorId: string
    block: T
    pagination: Readonly<{
      limit: number
      offset: number
    }>
  }>
  export type TWorker = Worker<TQueueInput, TQueueOutput, TJobName>
  export type TQueue = Queue<TQueueInput, TQueueOutput, TJobName>
  export type TProcessor = Processor<TQueueInput, TQueueOutput, TJobName>
}
