import { getEnvVars } from "./get-env-vars"
import {
  BlockGatewayService,
  createWorker,
  QueueNames,
} from "@api/block-gateway/core/shared"

export class BlockWebhook extends BlockGatewayService {
  constructor(private readonly envvars: ReturnType<typeof getEnvVars>) {
    super()
  }

  public async run() {
    // Processes jobs in the queue
    const worker = createWorker(
      this.envvars.BLOCK_WEBHOOK_REDIS_URL,
      QueueNames.BLOCK_WEBHOOK,
      async (job) => {
        // Sends the block data to the endpoint
        const res = await fetch(job.data.details.url, {
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
          body: JSON.stringify(job.data.payload, null, 2),
        })

        // Extracts header data
        const headers = new Map<string, string>()
        res.headers.forEach((v, k) => {
          headers.set(k, v)
        })

        // Logs the invocation data to the database
        return {
          subscriptionId: job.data.subscription.id,
          metadata: {
            subscription: job.data.subscription,
            details: job.data.details,
            result: {
              headers: Object.fromEntries(headers.entries()),
              body: await res.text(),
              redirected: res.redirected,
              status: res.status,
              type: res.type,
              url: res.url,
            },
          },
        }
      }
    )

    // Log a message when a job is completed
    worker.on("completed", async (job) => {
      console.log(`worker ${worker.name} completed job with ID ${job.id}`)
    })

    // Returns a cleanup function
    return async () => {
      await worker.close()
    }
  }
}
