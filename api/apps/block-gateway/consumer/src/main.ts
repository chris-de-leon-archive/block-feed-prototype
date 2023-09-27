import { blockconsumer } from "@api/block-gateway/core/block-consumer"
import { database } from "@api/shared/database"
import { utils } from "@api/shared/utils"
import { aws } from "@api/shared/aws"

const main = async () => {
  const service = new blockconsumer.BlockConsumer(
    blockconsumer.getEnvVars(),
    database.core.createClient(),
    aws.lambda.createClient()
  )

  await service.start()

  utils.onShutdown(async () => {
    await service.stop()
  })
}

main()
