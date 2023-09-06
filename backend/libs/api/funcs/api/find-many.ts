import { database } from "../../../shared/database"
import { trpc } from "../../../shared/trpc"
import { OPERATIONS } from "../constants"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"

export const FindManyInput = z.object({})

export const FindManyOutput = z.array(database.schema.selectFuncsSchema)

export const findMany = (t: ReturnType<(typeof trpc)["createTRPC"]>) => {
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
      .use(trpc.middleware.requireAuth(t))
      .query(async (params) => {
        const inputs = {
          placeholders: {
            userId: sql.placeholder(database.schema.funcs.userId.name),
          },
          values: {
            [database.schema.funcs.userId.name]: params.ctx.user.sub,
          },
        }

        const query = params.ctx.database
          .select()
          .from(database.schema.funcs)
          .where(eq(database.schema.funcs.userId, inputs.placeholders.userId))

        return await query
          .prepare(database.getPreparedStmtName(query.toSQL().sql))
          .execute(inputs.values)
          .catch(trpc.handleError)
      }),
  }
}
