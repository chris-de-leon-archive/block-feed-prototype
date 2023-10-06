import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { database } from "@api/shared/database"
import { getEnvVars } from "./get-env-vars"
import {
  BlockGatewayService,
  TBlockLogger,
  createWorker,
  QueueNames,
} from "@api/block-gateway/core/shared"

export class BlockLogger extends BlockGatewayService {
  constructor(
    private readonly envvars: ReturnType<typeof getEnvVars>,
    private readonly db: NodePgDatabase<typeof database.schema>
  ) {
    super()
  }

  public async run() {
    // Processes jobs in the queue
    const worker = createWorker(
      this.envvars.BLOCK_LOGGER_REDIS_URL,
      QueueNames.BLOCK_LOGGER,
      async (job) => {
        const results = await job
          .getChildrenValues<TBlockLogger.TChildValue>()
          .then((o) => Object.values(o))

        if (results.length === 0) {
          return
        }

        await this.db
          .insert(database.schema.invocationLog)
          .values(results)
          .then(({ rowCount }) => rowCount)
      }
    )

    // Log a message when a job is completed
    worker.on("completed", async (job) => {
      const counts = await job.getDependenciesCount()
      console.log(
        `worker ${worker.name} completed job with ID ${job.id} (processed = ${counts.processed}, unprocessed = ${counts.unprocessed})`
      )
    })

    // Returns a cleanup function
    return async () => {
      await worker.close()
    }
  }
}
