import { database } from "@api/shared/database"

export type IBlockchain = {
  getBlockAtHeight: (height: number) => Promise<object>
  getLatestBlockHeight: () => Promise<number>
  getInfo(): Readonly<{
    id: string
    name: database.schema.Blockchains
    networkURL: string
  }>
}
