import { blockdivider } from "@api/block-gateway/core/block-divider"
import { database } from "@api/shared/database"
import { utils } from "@api/shared/utils"

const main = async () => {
  const service = new blockdivider.BlockDivider(
    blockdivider.getEnvVars(),
    database.core.createClient()
  )

  await service.start()

  utils.onShutdown(async () => {
    await service.stop()
  })
}

main()
