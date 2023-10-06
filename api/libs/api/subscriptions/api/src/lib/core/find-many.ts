import { CONSTANTS, Ctx, OPERATIONS } from "./constants"
import { database } from "@api/shared/database"
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

export const FindManyOutput = z.array(database.schema.selectSubscriptionsSchema)

export const findMany = (t: ReturnType<typeof trpc.createTRPC<Ctx>>) => {
  return {
    [OPERATIONS.FIND_MANY.NAME]: t.procedure
      .meta({
        openapi: {
          method: OPERATIONS.FIND_MANY.METHOD,
          path: OPERATIONS.FIND_MANY.PATH,
        },
      })
      .input(FindManyInput)
      .output(FindManyOutput)
      .use(api.middleware.requireAuth(t))
      .query(async (params) => {
        return await database.queries.subscriptions
          .findMany(params.ctx.database, {
            userId: params.ctx.user.sub,
            limit: params.input.limit,
            offset: params.input.offset,
          })
          .catch(trpc.handleError)
      }),
  }
}
