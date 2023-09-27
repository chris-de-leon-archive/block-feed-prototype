import { createClient, getPreparedStmtName } from "../../core"
import { eq, type InferInsertModel } from "drizzle-orm"
import { funcs } from "../../schema"
import { sql } from "drizzle-orm"

export type CountByCursorInput = Readonly<
  Pick<InferInsertModel<typeof funcs>, "cursorId">
>

export const countByCursor = async (
  db: ReturnType<typeof createClient>,
  args: CountByCursorInput
) => {
  const inputs = {
    placeholders: {
      cursorId: sql.placeholder(funcs.cursorId.name),
    },
    values: {
      [funcs.cursorId.name]: args.cursorId,
    },
  }

  const query = db
    .select({ count: sql<number>`count(*)` })
    .from(funcs)
    .where(eq(funcs.cursorId, inputs.placeholders.cursorId))

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query
    .prepare(name)
    .execute(inputs.values)
    .then((rows) => rows.at(0)?.count ?? 0)
}
