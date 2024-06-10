import { GraphQLAuthContext } from "../../../graphql/types"
import { z } from "zod"

export const zInput = z.object({})

export const handler = async (
  _: z.infer<typeof zInput>,
  ctx: GraphQLAuthContext,
) => {
  return await ctx.vendor.db.drizzle.query.blockchain.findMany()
}
