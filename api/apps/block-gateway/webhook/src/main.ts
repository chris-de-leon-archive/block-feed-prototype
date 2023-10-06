import { blockwebhook } from "@api/block-gateway/core/block-webhook"
import { utils } from "@api/shared/utils"

const main = async () => {
  const env = blockwebhook.getEnvVars()

  const service = new blockwebhook.BlockWebhook(env)

  await service.start()

  utils.onShutdown(async () => {
    await service.stop()
  })
}

main()
