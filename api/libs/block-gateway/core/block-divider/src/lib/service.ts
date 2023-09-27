import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { database } from "@api/shared/database"
import { getEnvVars } from "./get-env-vars"
import {
  getDefaultJobOptions,
  BlockGatewayService,
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
        // Counts the total number of functions for this cursor in the database
        const count = await database.queries.funcs.countByCursor(this.db, {
          cursorId: job.data.cursorId,
        })

        // Adds all jobs to the queue using a single redis transaction
        const batchSze = this.envvars.MAX_FUNCS_PER_CONSUMER
        const batchCnt = Math.floor(count / batchSze) + 1
        await flow.addBulk(
          Array.from({ length: batchCnt }).map((_, i) => {
            return {
              queueName: QueueNames.BLOCK_CONSUMER,
              name: JobNames.CONSUME_BLOCK,
              data: {
                cursorId: job.data.cursorId,
                block: job.data,
                pagination: {
                  limit: batchSze,
                  offset: i * batchSze,
                },
              },
              opts: getDefaultJobOptions(),
            }
          })
        )
      }
    )

    // Return a cleanup function
    return async () => {
      await worker.close()
      await flow.close()
    }
  }
}
