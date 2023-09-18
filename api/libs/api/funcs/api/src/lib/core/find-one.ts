import { FuncsCtx, OPERATIONS } from "./constants"
import { database } from "@api/shared/database"
import { TRPCError } from "@trpc/server"
import { trpc } from "@api/shared/trpc"
import { z } from "zod"

export const FindOneInput = z.object({
  id: z.string().uuid(),
})

export const FindOneOutput = database.schema.selectFuncsSchema

export const findOne = (t: ReturnType<typeof trpc.createTRPC<FuncsCtx>>) => {
  return {
    [OPERATIONS.FIND_ONE.NAME]: t.procedure
      .meta({
        openapi: {
          method: OPERATIONS.FIND_ONE.METHOD,
          path: OPERATIONS.FIND_ONE.PATH,
        },
      })
      .input(FindOneInput)
      .output(FindOneOutput)
      .use(trpc.middleware.requireAuth(t))
      .query(async (params) => {
        const result = await database.queries.funcs
          .findOne(params.ctx.database, {
            id: params.input.id,
            userId: params.ctx.user.sub,
          })
          .catch(trpc.handleError)

        if (result == null) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `record with id "${params.input.id}" does not exist`,
          })
        }

        return result
      }),
  }
}
