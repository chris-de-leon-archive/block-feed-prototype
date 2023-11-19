import { mysqlEnum } from "drizzle-orm/mysql-core"

export enum Blockchains {
  FLOW = "FLOW",
  ETH = "ETH",
}

export const mysqlBlockchain = mysqlEnum("blockchain", [
  Blockchains.FLOW,
  Blockchains.ETH,
])
