import { Ctx, OPERATIONS } from "./constants"
import { database } from "@api/shared/database"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"
import { z } from "zod"

export const RemoveInput = z.object({
  id: z.string().uuid(),
})

export const RemoveOutput = z.object({
  count: z.number(),
})

export const remove = (t: ReturnType<typeof trpc.createTRPC<Ctx>>) => {
  return {
    [OPERATIONS.REMOVE.NAME]: t.procedure
      .meta({
        openapi: {
          method: OPERATIONS.REMOVE.METHOD,
          path: OPERATIONS.REMOVE.PATH,
        },
      })
      .input(RemoveInput)
      .output(RemoveOutput)
      .use(api.middleware.requireAuth(t))
      .mutation(async (params) => {
        return await database.queries.subscriptions
          .remove(params.ctx.database, {
            id: params.input.id,
          })
          .then(({ rowCount }) => ({ count: rowCount }))
          .catch(trpc.handleError)
      }),
  }
}
