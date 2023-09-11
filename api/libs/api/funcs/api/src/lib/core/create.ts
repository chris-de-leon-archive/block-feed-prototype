import { database } from "@api/shared/database"
import { OPERATIONS } from "./constants"
import { trpc } from "@api/shared/trpc"
import { sql } from "drizzle-orm"
import { z } from "zod"

export const CreateInput = z.object({
  name: z.string().min(1),
})

export const CreateOutput = z.object({
  count: z.number(),
})

export const create = (t: ReturnType<(typeof trpc)["createTRPC"]>) => {
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
      .use(trpc.middleware.requireAuth(t))
      .mutation(async (params) => {
        const inputs = {
          placeholders: {
            name: sql.placeholder(database.schema.funcs.name.name),
            userId: sql.placeholder(database.schema.funcs.userId.name),
          },
          values: {
            [database.schema.funcs.name.name]: params.input.name,
            [database.schema.funcs.userId.name]: params.ctx.user.sub,
          },
        }

        const query = params.ctx.database.insert(database.schema.funcs).values({
          name: inputs.placeholders.name,
          userId: inputs.placeholders.userId,
        })

        const { rowCount } = await query
          .prepare(database.getPreparedStmtName(query.toSQL().sql))
          .execute(inputs.values)
          .catch(trpc.handleError)

        return { count: rowCount }
      }),
  }
}
