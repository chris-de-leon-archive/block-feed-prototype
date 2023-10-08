import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { database } from "@api/shared/database"
import { getEnvVars } from "./get-env-vars"
import { Job } from "bullmq"
import {
  getDefaultJobOptions,
  BlockGatewayService,
  TBlockGatewayJob,
  TBlockConsumer,
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
        // Breaks up the input job into individual jobs
        const jobs = await this.splitJob(job)

        // Adds the jobs
        await flow.add({
          queueName: QueueNames.BLOCK_LOGGER,
          name: JobNames.LOG_BLOCK,
          children: jobs,
          opts: getDefaultJobOptions(),
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

  private async splitJob(job: Job<TBlockConsumer.TQueueInput>) {
    const funcMap: Record<
      database.schema.SubscriptionMethod,
      () => Promise<TBlockGatewayJob[]>
    > = {
      [database.schema.SubscriptionMethod.WEBHOOK]: async () => {
        return await this.generateWebhookJobs(job)
      },
      [database.schema.SubscriptionMethod.EMAIL]: async () => {
        return await this.generateEmailJobs(job)
      },
    }
    return await funcMap[job.data.method]()
  }

  private async generateWebhookJobs(job: Job<TBlockConsumer.TQueueInput>) {
    // NOTE: the block divider queue and this queue (i.e. the block consumer queue)
    // might be operating on different snapshots of the data. This can happen if the
    // DB data changes (e.g. new subscriptions were created or existing subscriptions
    // were removed). To help ensure that processing stays as consistent as possible,
    // the query below will automatically sort the data by timestamp then by uuid. This
    // has a few consequences:
    //
    //  1. If the number of active subscriptions has increased since the block divider, then
    //     the extra subscriptions will be processed the next time it goes through the block
    //     divider.
    //
    //  2. If the number of active subscriptions has decreased since the block divider, then the
    //     the block consumer may have some jobs that return 0 results from the database. This
    //     may result in overhead if a large number of subscriptions are deleted or deactivated.
    //
    //  3. If the number of active subscriptions remains the same then nothing will happen. This
    //     can happen if the number of deletions equals the number of creations. If this happens
    //     Some of the newly created subscriptions may be processed early, which is a good thing.
    //
    //  4. If subscriptions have been updated, then the updated data will be used here immediately
    //     and no issues will occur.
    //
    const results =
      await database.queries.subscriptions.findManyWebhookSubscriptionsBychainId(
        this.db,
        {
          chainId: job.data.chain.id,
          isActive: true,
          limit: job.data.pagination.limit,
          offset: job.data.pagination.offset,
        }
      )

    const jobs: TBlockGatewayJob[] = []
    for (const result of results) {
      const { subscriptions, webhook_subscriptions } = result
      if (subscriptions != null) {
        jobs.push({
          queueName: QueueNames.BLOCK_WEBHOOK,
          name: JobNames.POST_BLOCK,
          data: {
            subscription: subscriptions,
            details: webhook_subscriptions,
            payload: {
              chain: job.data.chain,
              block: job.data.block,
            },
          },
          opts: getDefaultJobOptions({
            attempts: webhook_subscriptions.attempts,
            backoff: {
              type: webhook_subscriptions.backoffStrategy,
              delay: webhook_subscriptions.backoffDelayMS,
            },
          }),
        })
      }
    }

    return jobs
  }

  private async generateEmailJobs(job: Job<TBlockConsumer.TQueueInput>) {
    // NOTE: the block divider queue and this queue (i.e. the block consumer queue)
    // might be operating on different snapshots of the data. This can happen if the
    // DB data changes (e.g. new subscriptions were created or existing subscriptions
    // were removed). To help ensure that processing stays as consistent as possible,
    // the query below will automatically sort the data by timestamp then by uuid. This
    // has a few consequences:
    //
    //  1. If the number of active subscriptions has increased since the block divider, then
    //     the extra subscriptions will be processed the next time it goes through the block
    //     divider.
    //
    //  2. If the number of active subscriptions has decreased since the block divider, then the
    //     the block consumer may have some jobs that return 0 results from the database. This
    //     may result in overhead if a large number of subscriptions are deleted or deactivated.
    //
    //  3. If the number of active subscriptions remains the same then nothing will happen. This
    //     can happen if the number of deletions equals the number of creations. If this happens
    //     Some of the newly created subscriptions may be processed early, which is a good thing.
    //
    //  4. If subscriptions have been updated, then the updated data will be used here immediately
    //     and no issues will occur.
    //
    const results =
      await database.queries.subscriptions.findManyEmailSubscriptionsBychainId(
        this.db,
        {
          chainId: job.data.chain.id,
          isActive: true,
          limit: job.data.pagination.limit,
          offset: job.data.pagination.offset,
        }
      )

    const jobs: TBlockGatewayJob[] = []
    for (const result of results) {
      const { subscriptions, email_subscriptions } = result
      if (subscriptions != null) {
        jobs.push({
          queueName: QueueNames.BLOCK_MAILER,
          name: JobNames.MAIL_BLOCK,
          data: {
            subscription: subscriptions,
            details: email_subscriptions,
            payload: {
              chain: job.data.chain,
              block: job.data.block,
            },
          },
          opts: getDefaultJobOptions({
            attempts: email_subscriptions.attempts,
            backoff: {
              type: email_subscriptions.backoffStrategy,
              delay: email_subscriptions.backoffDelayMS,
            },
          }),
        })
      }
    }

    return jobs
  }
}
