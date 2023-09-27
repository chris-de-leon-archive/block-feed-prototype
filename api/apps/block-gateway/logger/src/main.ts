import { blocklogger } from "@api/block-gateway/core/block-logger"
import { database } from "@api/shared/database"
import { utils } from "@api/shared/utils"

const main = async () => {
  const service = new blocklogger.BlockLogger(
    blocklogger.getEnvVars(),
    database.core.createClient()
  )

  await service.start()

  utils.onShutdown(async () => {
    await service.stop()
  })
}

main()
