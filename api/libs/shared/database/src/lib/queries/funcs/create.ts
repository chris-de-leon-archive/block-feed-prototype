import { createClient, getPreparedStmtName } from "../../core"
import { type InferInsertModel } from "drizzle-orm"
import { funcs } from "../../schema"
import { sql } from "drizzle-orm"

export type CreateInput = Readonly<
  Pick<InferInsertModel<typeof funcs>, "name" | "userId" | "cursorId">
>

export const create = async (
  db: ReturnType<typeof createClient>,
  args: CreateInput
) => {
  const inputs = {
    placeholders: {
      cursorId: sql.placeholder(funcs.cursorId.name),
      userId: sql.placeholder(funcs.userId.name),
      name: sql.placeholder(funcs.name.name),
    },
    values: {
      [funcs.cursorId.name]: args.cursorId,
      [funcs.userId.name]: args.userId,
      [funcs.name.name]: args.name,
    },
  }

  const query = db.insert(funcs).values({
    cursorId: inputs.placeholders.cursorId,
    userId: inputs.placeholders.userId,
    name: inputs.placeholders.name,
  })

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
