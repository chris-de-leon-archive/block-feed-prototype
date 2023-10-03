import { blockdivider } from "@api/block-gateway/core/block-divider"
import { database } from "@api/shared/database"
import { utils } from "@api/shared/utils"

const main = async () => {
  const env = blockdivider.getEnvVars()

  const service = new blockdivider.BlockDivider(
    env,
    database.core.createClient(env.BLOCK_DIVIDER_DB_URL)
  )

  await service.start()

  utils.onShutdown(async () => {
    await service.stop()
  })
}

main()
