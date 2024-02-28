import { CONSTANTS, Context, OPERATIONS } from "./constants"
import { db } from "@api/shared/database"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"
import { z } from "zod"

export const UpdateInput = z.object({
  id: z.string().uuid(),
  url: z.string().url(),
  maxBlocks: z
    .number()
    .int()
    .min(CONSTANTS.MAX_BLOCKS.MIN)
    .max(CONSTANTS.MAX_BLOCKS.MAX),
  maxRetries: z
    .number()
    .int()
    .min(CONSTANTS.MAX_RETRIES.MIN)
    .max(CONSTANTS.MAX_RETRIES.MAX),
  timeoutMs: z
    .number()
    .int()
    .min(CONSTANTS.TIMEOUT_MS.MIN)
    .max(CONSTANTS.TIMEOUT_MS.MAX),
})

export const UpdateOutput = z.object({
  count: z.number(),
})

export const update = (t: ReturnType<typeof trpc.createTRPC<Context>>) =>
  t.procedure
    .meta({
      openapi: {
        method: OPERATIONS.UPDATE.METHOD,
        path: OPERATIONS.UPDATE.PATH,
        protect: true,
      },
    })
    .input(UpdateInput)
    .output(UpdateOutput)
    .use(t.middleware(api.middleware.requireAuth))
    .mutation(async (params) => {
      return await db.queries.webhooks
        .update(params.ctx.database.drizzle, {
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
