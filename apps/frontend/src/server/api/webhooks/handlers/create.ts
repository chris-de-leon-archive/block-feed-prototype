import { AuthContext } from "@block-feed/server/graphql/types"
import { constants } from "@block-feed/shared/constants"
import * as schema from "@block-feed/drizzle"
import { randomUUID } from "crypto"
import { eq } from "drizzle-orm"
import { z } from "zod"
import {
  gqlInternalServerError,
  gqlBadRequestError,
} from "@block-feed/server/graphql/errors"

export const zInput = z.object({
  data: z.object({
    url: z
      .string()
      .url()
      .min(constants.webhooks.limits.URL_LEN.MIN)
      .max(constants.webhooks.limits.URL_LEN.MAX),
    maxBlocks: z
      .number()
      .int()
      .min(constants.webhooks.limits.MAX_BLOCKS.MIN)
      .max(constants.webhooks.limits.MAX_BLOCKS.MAX),
    maxRetries: z
      .number()
      .int()
      .min(constants.webhooks.limits.MAX_RETRIES.MIN)
      .max(constants.webhooks.limits.MAX_RETRIES.MAX),
    timeoutMs: z
      .number()
      .int()
      .min(constants.webhooks.limits.TIMEOUT_MS.MIN)
      .max(constants.webhooks.limits.TIMEOUT_MS.MAX),
    blockchainId: z
      .string()
      .min(constants.webhooks.limits.BLOCKCHAIN_ID.MIN)
      .max(constants.webhooks.limits.BLOCKCHAIN_ID.MAX),
  }),
})

export const handler = async (
  args: z.infer<typeof zInput>,
  ctx: AuthContext,
) => {
  const blockchainExists = await ctx.db.drizzle.query.blockchain.findFirst({
    where: eq(schema.blockchain.id, args.data.blockchainId),
  })

  if (blockchainExists == null) {
    throw gqlBadRequestError(
      `invalid blockchain ID "${args.data.blockchainId}"`,
    )
  }

  const uuid = randomUUID()
  return await ctx.db.drizzle
    .insert(schema.webhook)
    .values({
      id: uuid,
      isActive: 0,
      isQueued: 0,
      url: args.data.url,
      maxBlocks: args.data.maxBlocks,
      maxRetries: args.data.maxRetries,
      timeoutMs: args.data.timeoutMs,
      customerId: ctx.user.sub,
      blockchainId: args.data.blockchainId,
    })
    .then(([result]) => {
      if (result.affectedRows === 0) {
        throw gqlInternalServerError("failed to create webhook")
      } else {
        return { id: uuid }
      }
    })
}
