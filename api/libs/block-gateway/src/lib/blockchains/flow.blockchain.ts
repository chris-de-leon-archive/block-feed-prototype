import { database } from "@api/shared/database"
import { flow } from "@api/shared/flow"
import { IBlockchain } from "../types"
import * as crypto from "node:crypto"

export class FlowBlockchain implements IBlockchain {
  constructor(
    private readonly client: ReturnType<(typeof flow)["createClient"]>
  ) {}

  async getBlockAtHeight(height: number) {
    const encodedBlock = await this.client.fcl.send([
      this.client.fcl.getBlock(),
      this.client.fcl.atBlockHeight(height),
    ])
    return await this.client.fcl.decode(encodedBlock)
  }

  async getLatestBlockHeight() {
    const encodedBlock = await this.client.fcl.send([
      this.client.fcl.getBlock(true),
    ])
    return await this.client.fcl
      .decode(encodedBlock)
      .then((b: flow.Block) => b.height)
  }

  getInfo() {
    return {
      id: crypto
        .createHash("md5")
        .update(database.schema.Blockchains.FLOW)
        .update(this.client.env.url)
        .digest("hex"),
      name: database.schema.Blockchains.FLOW,
      networkURL: this.client.env.url,
    }
  }
}
