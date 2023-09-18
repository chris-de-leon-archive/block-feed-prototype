import { EthereumBlockchain } from "../blockchains/eth.blockchain"
import { database } from "@api/shared/database"
import { FlowBlockchain } from "../blockchains"
import { flow } from "@api/shared/flow"
import { IBlockchain } from "../types"
import { getEnvVars } from "../core"

export const resolveChainFromEnv = () => {
  const env = getEnvVars()

  const mapping: Record<database.schema.Blockchains, IBlockchain> = {
    [database.schema.Blockchains.FLOW]: new FlowBlockchain(flow.createClient()),
    [database.schema.Blockchains.ETH]: new EthereumBlockchain({}),
  }

  return mapping[env.blockchain]
}
