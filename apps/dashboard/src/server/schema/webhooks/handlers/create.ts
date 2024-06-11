import { GraphQLAuthContext } from "../../../graphql/types"
import { constants } from "@block-feed/node-shared"
import { randomUUID, randomInt } from "crypto"
import * as schema from "@block-feed/node-db"
import { eq } from "drizzle-orm"
import { z } from "zod"
import {
  gqlInternalServerError,
  gqlBadRequestError,
} from "../../../graphql/errors"

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
  ctx: GraphQLAuthContext,
) => {
  const blockchain =
    await ctx.providers.mysql.drizzle.query.blockchain.findFirst({
      where: eq(schema.blockchain.id, args.data.blockchainId),
    })
  if (blockchain == null) {
    throw gqlBadRequestError(
      `invalid blockchain ID "${args.data.blockchainId}"`,
    )
  }

  const uuid = randomUUID()
  return await ctx.providers.mysql.drizzle
    .insert(schema.webhook)
    .values({
      id: uuid,
      isActive: 0,
      url: args.data.url,
      maxBlocks: args.data.maxBlocks,
      maxRetries: args.data.maxRetries,
      timeoutMs: args.data.timeoutMs,
      customerId: ctx.clerk.user.id,
      blockchainId: args.data.blockchainId,
      shardId: randomInt(0, blockchain.shardCount),
    })
    .then(([result]) => {
      if (result.affectedRows === 0) {
        throw gqlInternalServerError("failed to create webhook")
      } else {
        return { id: uuid }
      }
    })
}
