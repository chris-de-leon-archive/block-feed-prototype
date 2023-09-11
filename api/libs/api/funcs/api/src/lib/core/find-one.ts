import { database } from "@api/shared/database"
import { and, eq, sql } from "drizzle-orm"
import { OPERATIONS } from "./constants"
import { TRPCError } from "@trpc/server"
import { trpc } from "@api/shared/trpc"
import { z } from "zod"

export const FindOneInput = z.object({
  id: z.string().uuid(),
})

export const FindOneOutput = database.schema.selectFuncsSchema

export const findOne = (t: ReturnType<(typeof trpc)["createTRPC"]>) => {
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
        const inputs = {
          placeholders: {
            id: sql.placeholder(database.schema.funcs.id.name),
            userId: sql.placeholder(database.schema.funcs.userId.name),
          },
          values: {
            [database.schema.funcs.id.name]: params.input.id,
            [database.schema.funcs.userId.name]: params.ctx.user.sub,
          },
        }

        const query = params.ctx.database
          .select()
          .from(database.schema.funcs)
          .where(
            and(
              eq(database.schema.funcs.id, inputs.placeholders.id),
              eq(database.schema.funcs.userId, inputs.placeholders.userId)
            )
          )
          .limit(1)

        const rslts = await query
          .prepare(database.getPreparedStmtName(query.toSQL().sql))
          .execute(inputs.values)
          .catch(trpc.handleError)

        if (rslts.length === 0) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `record with id "${params.input.id}" does not exist`,
          })
        }

        return rslts[0]
      }),
  }
}
