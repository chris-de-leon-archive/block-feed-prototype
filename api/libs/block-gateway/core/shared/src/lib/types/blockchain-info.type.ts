import { database } from "@api/shared/database"

export type TBlockchainInfo = Readonly<{
  id: string
  name: database.schema.Blockchains
  networkURL: string
}>
