import { db } from "@block-feed/server/vendor/database"
import { createSelectSchema } from "drizzle-zod"
import { trpc } from "@block-feed/server/trpc"
import { constants } from "../constants"
import { z } from "zod"

const zInput = z.object({
  limit: z
    .number()
    .int()
    .min(constants.LIMITS.LIMIT.MIN)
    .max(constants.LIMITS.LIMIT.MAX)
    .default(constants.LIMITS.LIMIT.MAX),
  offset: z
    .number()
    .int()
    .min(constants.LIMITS.OFFSET.MIN)
    .default(constants.LIMITS.OFFSET.MIN),
})

const zOutput = z.array(createSelectSchema(db.schema.webhook))

export const name = "findMany"

export const procedure = trpc.procedures.authedProcedure
  .meta({
    openapi: {
      method: "GET",
      path: `/${constants.NAMESPACE}`,
      protect: true,
    },
  })
  .input(zInput)
  .output(zOutput)
  .query(async (params) => {
    return await db.queries.webhooks.findMany(params.ctx.inner.db.drizzle, {
      where: {
        customerId: params.ctx.user.sub,
      },
      limit: params.input.limit,
      offset: params.input.offset,
    })
  })
