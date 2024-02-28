import { CONSTANTS, Context, OPERATIONS } from "./constants"
import { createSelectSchema } from "drizzle-zod"
import { db } from "@api/shared/database"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"
import { z } from "zod"

export const FindManyInput = z.object({
  limit: z
    .number()
    .int()
    .min(CONSTANTS.LIMIT.MIN)
    .max(CONSTANTS.LIMIT.MAX)
    .default(CONSTANTS.LIMIT.MAX),
  offset: z
    .number()
    .int()
    .min(CONSTANTS.OFFSET.MIN)
    .default(CONSTANTS.OFFSET.MIN),
})

export const FindManyOutput = z.array(createSelectSchema(db.schema.webhook))

export const findMany = (t: ReturnType<typeof trpc.createTRPC<Context>>) =>
  t.procedure
    .meta({
      openapi: {
        method: OPERATIONS.FIND_MANY.METHOD,
        path: OPERATIONS.FIND_MANY.PATH,
        protect: true,
      },
    })
    .input(FindManyInput)
    .output(FindManyOutput)
    .use(t.middleware(api.middleware.requireAuth))
    .query(async (params) => {
      return await db.queries.webhooks.findMany(params.ctx.database.drizzle, {
        where: {
          customerId: params.ctx.user.sub,
        },
        limit: params.input.limit,
        offset: params.input.offset,
      })
    })
