import { AuthContext } from "@block-feed/server/graphql/types"
import { z } from "zod"

export const zInput = z.object({})

export const handler = async (_: z.infer<typeof zInput>, ctx: AuthContext) => {
  return await ctx.db.drizzle.query.blockchain.findMany()
}
