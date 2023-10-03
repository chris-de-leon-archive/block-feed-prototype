import { getEnvVars } from "./get-env-vars"
import {
  getDefaultJobOptions,
  BlockGatewayService,
  TBlockFetcher,
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

  private async init(queue: TBlockFetcher.TQueue) {
    const count = await queue.count()
    if (count <= 0) {
      const latestBlockHeight = await this.blockchain.getLatestBlockHeight()
      await queue.add(JobNames.FETCH_BLOCK, latestBlockHeight, {
        ...getDefaultJobOptions(),
        jobId: this.createJobId(latestBlockHeight),
      })
    }
  }

  public async run() {
    // Create a block fetcher queue
    const queue = createQueue(
      this.envvars.BLOCK_FETCHER_REDIS_URL,
      QueueNames.BLOCK_FETCHER
    )

    // If the fetcher queue is empty, populate it with a starting job
    await this.init(queue)

    // Creates a flow
    const flow = createFlow(this.envvars.BLOCK_FETCHER_REDIS_URL)

    // Fetches blockchain info
    const chainInfo = this.blockchain.getInfo()

    // Processes jobs in the queue
    const worker = createWorker(
      this.envvars.BLOCK_FETCHER_REDIS_URL,
      QueueNames.BLOCK_FETCHER,
      async (job) => {
        // Don't add new jobs if the queue is backed up
        const count = await queue.count()
        if (count >= this.envvars.BLOCK_FETCHER_MAX_JOBS) {
          console.warn(
            `warning: number of jobs in queue (${count}) exceeds max (${this.envvars.BLOCK_FETCHER_MAX_JOBS})`
          )
          return
        }

        // If the block height is ahead, re-attempt the job
        const latestBlockHeight = await this.blockchain.getLatestBlockHeight()
        if (job.data > latestBlockHeight) {
          throw new Error(
            `requested block height "${job.data}" is larger than current block height "${latestBlockHeight}" (${chainInfo.name}, ${chainInfo.networkURL})`
          )
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
              attempts: Number.MAX_SAFE_INTEGER,
              delay: this.envvars.BLOCK_FETCHER_BLOCK_DELAY_MS,
              jobId: this.createJobId(job.data + 1),
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

    // Log a message when a job is completed
    worker.on("completed", async (job) => {
      const count = await queue.count()
      console.log(`completed job with ID ${job.id} (job count = ${count})`)
    })

    // Returns a cleanup function
    return async () => {
      await worker.close()
      await queue.close()
      await flow.close()
    }
  }
}
