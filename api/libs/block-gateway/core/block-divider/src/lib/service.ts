import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { database } from "@api/shared/database"
import { getEnvVars } from "./get-env-vars"
import { Job } from "bullmq"
import {
  getDefaultJobOptions,
  BlockGatewayService,
  TBlockGatewayJob,
  TBlockDivider,
  createWorker,
  createFlow,
  QueueNames,
  JobNames,
} from "@api/block-gateway/core/shared"

export class BlockDivider extends BlockGatewayService {
  constructor(
    private readonly envvars: ReturnType<typeof getEnvVars>,
    private readonly db: NodePgDatabase<typeof database.schema>
  ) {
    super()
  }

  public async run() {
    // Creates a flow
    const flow = createFlow(this.envvars.BLOCK_DIVIDER_REDIS_URL)

    // Processes jobs in the queue
    const worker = createWorker(
      this.envvars.BLOCK_DIVIDER_REDIS_URL,
      QueueNames.BLOCK_DIVIDER,
      async (job) => {
        // Breaks up the input job into individual jobs
        const jobs = await this.splitJob(job)

        // Adds the jobs
        await flow.addBulk(jobs)
      }
    )

    // Log a message when a job is completed
    worker.on("completed", async (job) => {
      console.log(`worker ${worker.name} completed job with ID ${job.id}`)
    })

    // Returns a cleanup function
    return async () => {
      await worker.close()
      await flow.close()
    }
  }

  private async splitJob(job: Job<TBlockDivider.TQueueInput>) {
    const counts = await this.countActiveSubs(job).then((r) => Object.values(r))

    const jobs = new Array<TBlockGatewayJob>()
    for (const { method, count } of counts) {
      const batchSze = this.envvars.MAX_ROWS_PER_CONSUMER
      const batchCnt = Math.floor(count / batchSze) + 1
      for (let i = 0; i < batchCnt; i++) {
        jobs.push({
          queueName: QueueNames.BLOCK_CONSUMER,
          name: JobNames.CONSUME_BLOCK,
          data: {
            method,
            chain: job.data.chain,
            block: job.data.block,
            pagination: {
              limit: batchSze,
              offset: i * batchSze,
            },
          },
          opts: getDefaultJobOptions(),
        } as const)
      }
    }

    return jobs
  }

  private async countActiveSubs(job: Job<TBlockDivider.TQueueInput>) {
    const counts =
      await database.queries.subscriptions.countActiveSubscriptionsByChainId(
        this.db,
        {
          chainId: job.data.chain.id,
        }
      )

    // Putting the result above into an intermediate object allows for better
    // typing support (i.e. if a new value is added to the SubscriptionMethod
    // enum this code will be highlighted red for us automatically)
    const countMap: Record<
      database.schema.SubscriptionMethod,
      Readonly<{
        method: database.schema.SubscriptionMethod
        count: number
      }>
    > = {
      [database.schema.SubscriptionMethod.WEBHOOK]: {
        method: database.schema.SubscriptionMethod.WEBHOOK,
        count: counts.activeWebhookSubscriptions,
      },
      [database.schema.SubscriptionMethod.EMAIL]: {
        method: database.schema.SubscriptionMethod.EMAIL,
        count: counts.activeEmailSubscriptions,
      },
    }

    return countMap
  }
}
