import { createClient, getPreparedStmtName } from "../../core"
import { type InferSelectModel } from "drizzle-orm"
import { eq, sql } from "drizzle-orm"
import { funcs } from "../../schema"

export type RemoveInput = Readonly<Pick<InferSelectModel<typeof funcs>, "id">>

export const remove = async (
  db: ReturnType<typeof createClient>,
  args: RemoveInput
) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(funcs.id.name).getSQL(),
    },
    values: {
      [funcs.id.name]: args.id,
    },
  }

  const query = db.delete(funcs).where(eq(funcs.id, inputs.placeholders.id))

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
