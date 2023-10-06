import { CONSTANTS, Ctx, OPERATIONS } from "./constants"
import { database } from "@api/shared/database"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"
import { z } from "zod"

export const CreateInput = z.object({
  name: z.string().min(CONSTANTS.NAME.MIN_LEN).max(CONSTANTS.NAME.MAX_LEN),
  cursorId: z
    .string()
    .min(CONSTANTS.CURSOR_ID.MIN_LEN)
    .max(CONSTANTS.CURSOR_ID.MAX_LEN),
})

export const CreateOutput = z.object({
  count: z.number(),
})

export const create = (t: ReturnType<typeof trpc.createTRPC<Ctx>>) => {
  return {
    [OPERATIONS.CREATE.NAME]: t.procedure
      .meta({
        openapi: {
          method: OPERATIONS.CREATE.METHOD,
          path: OPERATIONS.CREATE.PATH,
        },
      })
      .input(CreateInput)
      .output(CreateOutput)
      .use(api.middleware.requireAuth(t))
      .mutation(async (params) => {
        return await database.queries.subscriptions
          .create(params.ctx.database, {
            cursorId: params.input.cursorId,
            userId: params.ctx.user.sub,
            name: params.input.name,
          })
          .then(({ rowCount }) => ({ count: rowCount }))
          .catch(trpc.handleError)
      }),
  }
}
