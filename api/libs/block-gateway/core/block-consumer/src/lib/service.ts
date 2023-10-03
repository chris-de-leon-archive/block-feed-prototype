import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { database } from "@api/shared/database"
import { InferInsertModel } from "drizzle-orm"
import { getEnvVars } from "./get-env-vars"
import {
  getDefaultJobOptions,
  BlockGatewayService,
  createWorker,
  createFlow,
  QueueNames,
  JobNames,
} from "@api/block-gateway/core/shared"
import {
  InvocationType,
  InvokeCommand,
  LambdaClient,
  LogType,
} from "@aws-sdk/client-lambda"

export class BlockConsumer extends BlockGatewayService {
  constructor(
    private readonly envvars: ReturnType<typeof getEnvVars>,
    private readonly db: NodePgDatabase<typeof database.schema>,
    private readonly lambda: LambdaClient
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
        const rows = await database.queries.funcs.findManyByCursorId(this.db, {
          cursorId: job.data.cursorId,
          limit: job.data.pagination.limit,
          offset: job.data.pagination.offset,
        })

        // Invokes all lambda functions asynchronously in parallel
        const settled = await Promise.allSettled(
          rows.map(async (r) => {
            return await this.lambda.send(
              new InvokeCommand({
                FunctionName: r.name,
                InvocationType: InvocationType.RequestResponse,
                LogType: LogType.Tail,
                Payload: JSON.stringify(job.data.block),
              })
            )
          })
        )

        // Creates an array to hold invocation data
        const results: InferInsertModel<
          typeof database.schema.invocationLog
        >[] = []

        // Adds entries to the results array
        settled.forEach((r, i) => {
          if (r.status === "rejected") {
            return
          }

          const payload =
            r.value.Payload != null
              ? new TextDecoder("utf-8").decode(r.value.Payload.buffer)
              : ""

          const logResult = Buffer.from(
            r.value.LogResult ?? "",
            "base64"
          ).toString("utf-8")

          results.push({
            metadata: r.value.$metadata,
            userId: rows[i].userId,
            executedVersion: r.value.ExecutedVersion,
            functionError: r.value.FunctionError,
            statusCode: r.value.StatusCode,
            logResult,
            payload,
          })
        })

        // Logs the invocation data to the database
        await flow.add({
          queueName: QueueNames.BLOCK_LOGGER,
          name: JobNames.LOG_BLOCK,
          data: results,
          opts: getDefaultJobOptions(),
        })
      }
    )

    // Log a message when a job is completed
    worker.on("completed", async (job) => {
      console.log(`completed job with ID ${job.id}`)
    })

    // Returns a cleanup function
    return async () => {
      await worker.close()
      await flow.close()
    }
  }
}
