import { blockmailer } from "@api/block-gateway/core/block-mailer"
import { SESClient } from "@aws-sdk/client-ses"
import { utils } from "@api/shared/utils"
import { aws } from "@api/shared/aws"

const main = async () => {
  const env = {
    blockMailer: blockmailer.getEnvVars(),
    aws: aws.core.getEnvVars(),
  }

  const service = new blockmailer.BlockMailer(
    env.blockMailer,
    new SESClient({
      endpoint: env.aws.AWS_ENDPOINT,
      credentials: {
        accessKeyId: env.aws.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.aws.AWS_SECRET_ACCESS_KEY,
      },
      region: env.aws.AWS_REGION,
    })
  )

  await service.start()

  utils.onShutdown(async () => {
    await service.stop()
  })
}

main()
