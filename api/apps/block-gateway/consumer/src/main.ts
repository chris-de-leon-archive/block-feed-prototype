import { blockconsumer } from "@api/block-gateway/core/block-consumer"
import { database } from "@api/shared/database"
import { utils } from "@api/shared/utils"

const main = async () => {
  const env = blockconsumer.getEnvVars()

  const service = new blockconsumer.BlockConsumer(
    env,
    database.core.createClient(env.BLOCK_CONSUMER_DB_URL)
  )

  await service.start()

  utils.onShutdown(async () => {
    await service.stop()
  })
}

main()
