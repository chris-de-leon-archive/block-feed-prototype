import { db } from "@block-feed/server/vendor/database"
import { trpc } from "@block-feed/server/trpc"
import { constants } from "../constants"
import { TRPCError } from "@trpc/server"
import { z } from "zod"

const zInput = z.object({
  url: z.string().url(),
  maxBlocks: z
    .number()
    .int()
    .min(constants.LIMITS.MAX_BLOCKS.MIN)
    .max(constants.LIMITS.MAX_BLOCKS.MAX),
  maxRetries: z
    .number()
    .int()
    .min(constants.LIMITS.MAX_RETRIES.MIN)
    .max(constants.LIMITS.MAX_RETRIES.MAX),
  timeoutMs: z
    .number()
    .int()
    .min(constants.LIMITS.TIMEOUT_MS.MIN)
    .max(constants.LIMITS.TIMEOUT_MS.MAX),
  blockchainId: z
    .string()
    .min(constants.LIMITS.BLOCKCHAIN_ID.MIN)
    .max(constants.LIMITS.BLOCKCHAIN_ID.MAX),
})

const zOutput = z.object({
  id: z.string().nullable(),
})

export const name = "create"

export const procedure = trpc.procedures.authedProcedure
  .meta({
    openapi: {
      method: "POST",
      path: `/${constants.NAMESPACE}`,
      protect: true,
    },
  })
  .input(zInput)
  .output(zOutput)
  .mutation(async (params) => {
    const blockchainExists = await db.queries.blockchains.findOne(
      params.ctx.inner.db.drizzle,
      {
        where: {
          id: params.input.blockchainId,
        },
      },
    )
    if (blockchainExists == null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `invalid blockchain ID "${params.input.blockchainId}"`,
      })
    }

    const webhook = await db.queries.webhooks.create(
      params.ctx.inner.db.drizzle,
      {
        data: {
          isActive: 0,
          url: params.input.url,
          maxBlocks: params.input.maxBlocks,
          maxRetries: params.input.maxRetries,
          timeoutMs: params.input.timeoutMs,
          customerId: params.ctx.user.sub,
          blockchainId: params.input.blockchainId,
        },
      },
    )
    if (webhook.id == null) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "failed to create webhook",
      })
    }

    return { id: webhook.id }
  })
