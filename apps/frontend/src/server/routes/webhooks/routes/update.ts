import { db } from "@block-feed/server/vendor/database"
import { trpc } from "@block-feed/server/trpc"
import { constants } from "../constants"
import { z } from "zod"

const zInput = z.object({
  id: z.string().uuid(),
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
})

const zOutput = z.object({
  count: z.number(),
})

export const name = "update"

export const procedure = trpc.procedures.authedProcedure
  .meta({
    openapi: {
      method: "PATCH",
      path: `/${constants.NAMESPACE}/{id}`,
      protect: true,
    },
  })
  .input(zInput)
  .output(zOutput)
  .mutation(async (params) => {
    return await db.queries.webhooks
      .update(params.ctx.inner.db.drizzle, {
        where: {
          id: params.input.id,
          customerId: params.ctx.user.sub,
        },
        data: {
          maxRetries: params.input.maxRetries,
          maxBlocks: params.input.maxBlocks,
          timeoutMs: params.input.timeoutMs,
          url: params.input.url,
        },
      })
      .then(([result]) => ({ count: result.affectedRows }))
  })
