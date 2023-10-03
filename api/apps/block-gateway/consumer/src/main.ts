import { blockconsumer } from "@api/block-gateway/core/block-consumer"
import { LambdaClient } from "@aws-sdk/client-lambda"
import { database } from "@api/shared/database"
import { utils } from "@api/shared/utils"
import { aws } from "@api/shared/aws"

const main = async () => {
  const env = {
    blockConsumer: blockconsumer.getEnvVars(),
    aws: aws.core.getEnvVars(),
  }

  const service = new blockconsumer.BlockConsumer(
    env.blockConsumer,
    database.core.createClient(env.blockConsumer.BLOCK_CONSUMER_DB_URL),
    new LambdaClient({
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
