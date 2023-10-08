import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses"
import { getEnvVars } from "./get-env-vars"
import {
  BlockGatewayService,
  createWorker,
  QueueNames,
} from "@api/block-gateway/core/shared"

export class BlockMailer extends BlockGatewayService {
  constructor(
    private readonly envvars: ReturnType<typeof getEnvVars>,
    private readonly ses: SESClient
  ) {
    super()
  }

  public async run() {
    // Processes jobs in the queue
    const worker = createWorker(
      this.envvars.BLOCK_MAILER_REDIS_URL,
      QueueNames.BLOCK_MAILER,
      async (job) => {
        // Emails the block data to the specified address
        const res = await this.ses.send(
          new SendEmailCommand({
            Source: this.envvars.BLOCK_MAILER_EMAIL_SOURCE,
            Destination: {
              ToAddresses: [job.data.details.email],
            },
            Message: {
              Subject: {
                Data: `Block Feed Notification (${job.data.subscription.name})`,
              },
              Body: {
                Text: {
                  Data: JSON.stringify(job.data.payload, null, 2),
                },
              },
            },
          })
        )

        // Logs the invocation data to the database
        return {
          subscriptionId: job.data.subscription.id,
          metadata: {
            subscription: job.data.subscription,
            details: job.data.details,
            result: res,
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
