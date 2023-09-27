import { getEnvVars } from "./get-env-vars"
import {
  getDefaultJobOptions,
  BlockGatewayService,
  createWorker,
  TBlockchain,
  createQueue,
  createFlow,
  QueueNames,
  JobNames,
} from "@api/block-gateway/core/shared"

export class BlockFetcher extends BlockGatewayService {
  constructor(
    private readonly envvars: ReturnType<typeof getEnvVars>,
    private readonly blockchain: TBlockchain
  ) {
    super()
  }

  private createJobId(height: number | string) {
    return `j-${height.toString(10)}`
  }

  private async init() {
    const queue = createQueue(
      this.envvars.BLOCK_FETCHER_REDIS_URL,
      QueueNames.BLOCK_FETCHER
    )

    try {
      const count = await queue.count()
      if (count <= 0) {
        const latestBlockHeight = await this.blockchain.getLatestBlockHeight()
        await queue.add(JobNames.FETCH_BLOCK, latestBlockHeight, {
          ...getDefaultJobOptions(),
          jobId: this.createJobId(latestBlockHeight),
        })
      }
    } finally {
      await queue.close()
    }
  }

  public async run() {
    // If the cursor queue is empty, populate it with a starting job
    await this.init()

    // Creates a flow
    const flow = createFlow(this.envvars.BLOCK_FETCHER_REDIS_URL)

    // Fetches blockchain info
    const chainInfo = this.blockchain.getInfo()

    // Processes jobs in the queue
    const worker = createWorker(
      this.envvars.BLOCK_FETCHER_REDIS_URL,
      QueueNames.BLOCK_FETCHER,
      async (job) => {
        // If the block height is ahead, requeue the job with an added delay
        const latestBlockHeight = await this.blockchain.getLatestBlockHeight()
        if (job.data > latestBlockHeight) {
          await flow.add({
            queueName: QueueNames.BLOCK_FETCHER,
            name: JobNames.FETCH_BLOCK,
            data: job.data,
            opts: {
              ...getDefaultJobOptions(),
              jobId: this.createJobId(job.data),
              delay: this.envvars.BLOCK_FETCHER_BLOCK_DELAY_MS,
              lifo: true,
            },
          })
          return
        }

        // Fetches the current block data and send it to the other queues
        const block = await this.blockchain.getBlockAtHeight(job.data)
        await flow.addBulk([
          {
            queueName: QueueNames.BLOCK_FETCHER,
            name: JobNames.FETCH_BLOCK,
            data: job.data + 1,
            opts: {
              ...getDefaultJobOptions(),
              jobId: this.createJobId(job.data + 1),
              delay: this.envvars.BLOCK_FETCHER_BLOCK_DELAY_MS,
            },
          },
          {
            queueName: QueueNames.BLOCK_DIVIDER,
            name: JobNames.DIVIDE_BLOCK,
            data: {
              cursorId: chainInfo.id,
              block,
            },
            opts: getDefaultJobOptions(),
          },
        ])
        return
      }
    )

    // Returns a cleanup function
    return async () => {
      await worker.close()
      await flow.close()
    }
  }
}
