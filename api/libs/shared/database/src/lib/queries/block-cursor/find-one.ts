import { createClient, getPreparedStmtName } from "../../core"
import { type InferSelectModel } from "drizzle-orm"
import { blockCursor } from "../../schema"
import { sql } from "drizzle-orm"

export type FindOneInput = Readonly<
  Pick<InferSelectModel<typeof blockCursor>, "id">
>

export const findOne = async (
  db: ReturnType<typeof createClient>,
  args: FindOneInput
) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(blockCursor.id.name),
    },
    values: {
      [blockCursor.id.name]: args.id,
    },
  }

  const query = db.query.blockCursor.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, inputs.placeholders.id)
    },
  })

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
