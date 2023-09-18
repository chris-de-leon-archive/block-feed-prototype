import { createClient, getPreparedStmtName } from "../../core"
import { type InferSelectModel } from "drizzle-orm"
import { funcs } from "../../schema"
import { sql } from "drizzle-orm"

export type FindOneInput = Readonly<
  Pick<InferSelectModel<typeof funcs>, "id" | "userId">
>

export const findOne = async (
  db: ReturnType<typeof createClient>,
  args: FindOneInput
) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(funcs.id.name),
      userId: sql.placeholder(funcs.userId.name),
    },
    values: {
      [funcs.id.name]: args.id,
      [funcs.userId.name]: args.userId,
    },
  }

  const query = db.query.funcs.findFirst({
    where(fields, operators) {
      return operators.and(
        operators.eq(fields.id, inputs.placeholders.id),
        operators.eq(fields.userId, inputs.placeholders.userId)
      )
    },
  })

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
