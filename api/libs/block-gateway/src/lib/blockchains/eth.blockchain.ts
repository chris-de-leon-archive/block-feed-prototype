import { database } from "@api/shared/database"
import { IBlockchain } from "../types"

export class EthereumBlockchain implements IBlockchain {
  constructor(private readonly client: unknown) {}

  async getBlockAtHeight(height: number) {
    throw new Error("Function not implemented.")
    return {}
  }

  async getLatestBlockHeight() {
    throw new Error("Function not implemented.")
    return 0
  }

  getInfo() {
    throw new Error("Function not implemented.")
    return {
      id: "",
      name: database.schema.Blockchains.ETH,
      networkURL: "",
    }
  }
}
