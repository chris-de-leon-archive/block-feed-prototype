import { createClient, getPreparedStmtName } from "../../core"
import { type InferSelectModel } from "drizzle-orm"
import { blockchains } from "../../schema"
import { sql } from "drizzle-orm"

export type FindOneInput = Readonly<
  Pick<InferSelectModel<typeof blockchains>, "id">
>

export const findOne = async (
  db: ReturnType<typeof createClient>,
  args: FindOneInput
) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(blockchains.id.name),
    },
    values: {
      [blockchains.id.name]: args.id,
    },
  }

  const query = db.query.blockchains.findFirst({
    where(fields, operators) {
      return operators.eq(fields.id, inputs.placeholders.id)
    },
  })

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
