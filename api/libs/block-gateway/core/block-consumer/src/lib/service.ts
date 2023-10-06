import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { database } from "@api/shared/database"
import { getEnvVars } from "./get-env-vars"
import {
  getDefaultJobOptions,
  BlockGatewayService,
  TBlockGatewayJob,
  createWorker,
  createFlow,
  QueueNames,
  JobNames,
} from "@api/block-gateway/core/shared"

export class BlockConsumer extends BlockGatewayService {
  constructor(
    private readonly envvars: ReturnType<typeof getEnvVars>,
    private readonly db: NodePgDatabase<typeof database.schema>
  ) {
    super()
  }

  public async run() {
    // Creates a flow
    const flow = createFlow(this.envvars.BLOCK_CONSUMER_REDIS_URL)

    // Processes jobs in the queue
    const worker = createWorker(
      this.envvars.BLOCK_CONSUMER_REDIS_URL,
      QueueNames.BLOCK_CONSUMER,
      async (job) => {
        // Fetches a batch of rows
        const rows = await database.queries.subscriptions.findManyByCursorId(
          this.db,
          {
            cursorId: job.data.cursorId,
            limit: job.data.pagination.limit,
            offset: job.data.pagination.offset,
          }
        )

        // Creates jobs
        const jobs: TBlockGatewayJob[] = []
        rows.forEach((r) => {
          const { webhookSubscription, emailSubscription, ...subscription } = r
          if (webhookSubscription != null) {
            jobs.push({
              queueName: QueueNames.BLOCK_WEBHOOK,
              name: JobNames.POST_BLOCK,
              data: {
                subscription,
                details: webhookSubscription,
                payload: job.data.block,
              },
              opts: {
                ...getDefaultJobOptions(),
                attempts: webhookSubscription.attempts,
              },
            })
          }
          if (emailSubscription != null) {
            jobs.push({
              queueName: QueueNames.BLOCK_MAILER,
              name: JobNames.MAIL_BLOCK,
              data: {
                subscription,
                details: emailSubscription,
                payload: job.data.block,
              },
              opts: {
                ...getDefaultJobOptions(),
                attempts: emailSubscription.attempts,
              },
            })
          }
        })

        // Adds jobs
        await flow.add({
          queueName: QueueNames.BLOCK_LOGGER,
          name: JobNames.LOG_BLOCK,
          children: jobs,
        })
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
}
