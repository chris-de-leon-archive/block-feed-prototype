import { database } from "@api/shared/database"
import { utils } from "@api/shared/utils"

export const getEnvVars = () => {
  const blockchain = utils.getRequiredEnvVar(
    "BLOCKGATEWAY_BLOCKCHAIN"
  ) as database.schema.Blockchains

  const validBlockchains = Object.values(database.schema.Blockchains)
  if (!validBlockchains.includes(blockchain)) {
    throw new Error(
      `"BLOCKGATEWAY_BLOCKCHAIN" must be one of ${validBlockchains}`
    )
  }

  return {
    blockchain,
  }
}
