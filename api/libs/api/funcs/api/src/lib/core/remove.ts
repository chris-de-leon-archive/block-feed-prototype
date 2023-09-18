import { FuncsCtx, OPERATIONS } from "./constants"
import { database } from "@api/shared/database"
import { trpc } from "@api/shared/trpc"
import { z } from "zod"

export const RemoveInput = z.object({
  id: z.string().uuid(),
})

export const RemoveOutput = z.object({
  count: z.number(),
})

export const remove = (t: ReturnType<typeof trpc.createTRPC<FuncsCtx>>) => {
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
      .use(trpc.middleware.requireAuth(t))
      .mutation(async (params) => {
        return await database.queries.funcs
          .remove(params.ctx.database, {
            id: params.input.id,
          })
          .then(({ rowCount }) => ({ count: rowCount }))
          .catch(trpc.handleError)
      }),
  }
}
