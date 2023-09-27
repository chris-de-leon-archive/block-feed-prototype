import { FlowBlockchain } from "@api/block-gateway/core/blockchains/flow"
import { blockfetcher } from "@api/block-gateway/core/block-fetcher"
import { utils } from "@api/shared/utils"
import { flow } from "@api/shared/flow"

const main = async () => {
  const service = new blockfetcher.BlockFetcher(
    blockfetcher.getEnvVars(),
    new FlowBlockchain(flow.createClient())
  )

  await service.start()

  utils.onShutdown(async () => {
    await service.stop()
  })
}

main()
