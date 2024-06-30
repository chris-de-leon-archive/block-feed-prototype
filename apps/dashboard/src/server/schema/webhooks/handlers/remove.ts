import { constants } from "@block-feed/dashboard/utils/constants"
import { GraphQLAuthContext } from "../../../graphql/types"
import { and, eq, inArray } from "drizzle-orm"
import * as schema from "@block-feed/node-db"
import { z } from "zod"

export const zInput = z.object({
  ids: z
    .array(z.string().uuid())
    .min(constants.webhooks.limits.MAX_UUIDS.MIN)
    .max(constants.webhooks.limits.MAX_UUIDS.MAX),
})

export const handler = async (
  args: z.infer<typeof zInput>,
  ctx: GraphQLAuthContext,
) => {
  if (args.ids.length === 0) {
    return { count: 0 }
  }

  return await ctx.providers.mysql.drizzle
    .delete(schema.webhook)
    .where(
      and(
        eq(schema.webhook.customerId, ctx.clerk.user.id),
        inArray(schema.webhook.id, args.ids),
      ),
    )
    .then(([result]) => ({
      count: result.affectedRows,
    }))
}
