import { blocklogger } from "@api/block-gateway/core/block-logger"
import { database } from "@api/shared/database"
import { utils } from "@api/shared/utils"

const main = async () => {
  const env = blocklogger.getEnvVars()

  const service = new blocklogger.BlockLogger(
    env,
    database.core.createClient(env.BLOCK_LOGGER_DB_URL)
  )

  await service.start()

  utils.onShutdown(async () => {
    await service.stop()
  })
}

main()
