import { TBlockchainInfo } from "./blockchain-info.type"
import { QueueNames } from "../enums/queue-names.enum"
import { JobNames } from "../enums/job-names.enum"
import { Processor, Queue, Worker } from "bullmq"

export namespace TBlockDivider {
  export type TQueueName = QueueNames.BLOCK_DIVIDER
  export type TJobName = JobNames.DIVIDE_BLOCK
  export type TQueueOutput = void
  export type TQueueInput = Readonly<{
    chain: Readonly<TBlockchainInfo>
    block: Readonly<object>
  }>
  export type TWorker = Worker<TQueueInput, TQueueOutput, TJobName>
  export type TQueue = Queue<TQueueInput, TQueueOutput, TJobName>
  export type TProcessor = Processor<TQueueInput, TQueueOutput, TJobName>
}
