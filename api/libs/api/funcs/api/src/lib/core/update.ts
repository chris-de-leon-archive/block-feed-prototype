import { database } from "@api/shared/database"
import { and, eq, sql } from "drizzle-orm"
import { OPERATIONS } from "./constants"
import { trpc } from "@api/shared/trpc"
import { z } from "zod"

export const UpdateInput = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
})

export const UpdateOutput = z.object({
  count: z.number(),
})

export const update = (t: ReturnType<(typeof trpc)["createTRPC"]>) => {
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
        const inputs = {
          placeholders: {
            id: sql.placeholder(database.schema.funcs.id.name).getSQL(),
            name: sql.placeholder(database.schema.funcs.name.name).getSQL(),
            userId: sql.placeholder(database.schema.funcs.userId.name).getSQL(),
          },
          values: {
            [database.schema.funcs.id.name]: params.input.id,
            [database.schema.funcs.name.name]: params.input.name,
            [database.schema.funcs.userId.name]: params.ctx.user.sub,
          },
        }

        const query = params.ctx.database
          .update(database.schema.funcs)
          .set({
            name: inputs.placeholders.name,
          })
          .where(
            and(
              eq(database.schema.funcs.id, inputs.placeholders.id),
              eq(database.schema.funcs.userId, inputs.placeholders.userId)
            )
          )

        const { rowCount } = await query
          .prepare(database.getPreparedStmtName(query.toSQL().sql))
          .execute(inputs.values)
          .catch(trpc.handleError)

        return { count: rowCount }
      }),
  }
}
