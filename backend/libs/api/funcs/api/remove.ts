import { database } from "../../../shared/database"
import { trpc } from "../../../shared/trpc"
import { OPERATIONS } from "../constants"
import { eq, sql } from "drizzle-orm"
import { z } from "zod"

export const RemoveInput = z.object({
  id: z.string().uuid(),
})

export const RemoveOutput = z.object({
  count: z.number(),
})

export const remove = (t: ReturnType<(typeof trpc)["createTRPC"]>) => {
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
        const inputs = {
          placeholders: {
            id: sql.placeholder(database.schema.funcs.id.name).getSQL(),
          },
          values: {
            [database.schema.funcs.id.name]: params.input.id,
          },
        }

        const query = params.ctx.database
          .delete(database.schema.funcs)
          .where(eq(database.schema.funcs.id, inputs.placeholders.id))

        const { rowCount } = await query
          .prepare(database.getPreparedStmtName(query.toSQL().sql))
          .execute(inputs.values)
          .catch(trpc.handleError)

        return { count: rowCount }
      }),
  }
}
