import { CONSTANTS, Context, OPERATIONS } from "./constants"
import { database } from "@api/shared/database"
import { trpc } from "@api/shared/trpc"
import { api } from "@api/api/core"
import { z } from "zod"

export const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z
    .string()
    .min(CONSTANTS.NAME.LEN.MIN)
    .max(CONSTANTS.NAME.LEN.MAX)
    .optional(),
})

export const UpdateOutput = z.object({
  count: z.number().nullable(),
})

export const update = (t: ReturnType<typeof trpc.createTRPC<Context>>) => {
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
      .use(api.middleware.requireAuth(t))
      .mutation(async (params) => {
        return await database.queries.relayers
          .update(params.ctx.database, {
            id: params.input.id as any,
            name: params.input.name,
            userId: params.ctx.user.sub,
          })
          .then((result) => ({ count: result[0].affectedRows }))
      }),
  }
}
