import { CONSTANTS, FuncsCtx, OPERATIONS } from "./constants"
import { database } from "@api/shared/database"
import { trpc } from "@api/shared/trpc"
import { z } from "zod"

export const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(CONSTANTS.NAME.MIN_LEN).max(CONSTANTS.NAME.MAX_LEN),
})

export const UpdateOutput = z.object({
  count: z.number(),
})

export const update = (t: ReturnType<typeof trpc.createTRPC<FuncsCtx>>) => {
  return {
    [OPERATIONS.UPDATE.NAME]: t.procedure
      .meta({
        openapi: {
          method: OPERATIONS.UPDATE.METHOD,
          path: OPERATIONS.UPDATE.PATH,
        },
      })
      .input(UpdateInput)
      .output(UpdateOutput)
      .use(trpc.middleware.requireAuth(t))
      .mutation(async (params) => {
        return await database.queries.funcs
          .update(params.ctx.database, {
            id: params.input.id,
            name: params.input.name,
            userId: params.ctx.user.sub,
          })
          .then(({ rowCount }) => ({ count: rowCount }))
          .catch(trpc.handleError)
      }),
  }
}
