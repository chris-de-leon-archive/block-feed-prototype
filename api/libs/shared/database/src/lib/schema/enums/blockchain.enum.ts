import { pgEnum } from "drizzle-orm/pg-core"

export enum Blockchains {
  FLOW = "FLOW",
  ETH = "ETH",
}

// TODO: https://github.com/drizzle-team/drizzle-orm/issues/669
export const blockchainEnum = pgEnum("blockchain", [
  Blockchains.ETH,
  ...Object.values(Blockchains),
])
