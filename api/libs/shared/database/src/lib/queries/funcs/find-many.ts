import { CONSTANTS, createClient, getPreparedStmtName } from "../../core"
import { type InferSelectModel } from "drizzle-orm"
import { RowLimit, RowOffset } from "../../types"
import { funcs } from "../../schema"
import { sql } from "drizzle-orm"

export type FindManyInput = Readonly<
  Pick<InferSelectModel<typeof funcs>, "userId"> & RowLimit & RowOffset
>

export const findMany = async (
  db: ReturnType<typeof createClient>,
  args: FindManyInput
) => {
  const inputs = {
    placeholders: {
      userId: sql.placeholder(funcs.userId.name),
      limit: sql.placeholder(CONSTANTS.LIMIT),
      offset: sql.placeholder(CONSTANTS.OFFSET),
    },
    values: {
      [funcs.userId.name]: args.userId,
      [CONSTANTS.LIMIT]: args.limit,
      [CONSTANTS.OFFSET]: args.offset,
    },
  }

  const query = db.query.funcs.findMany({
    where(fields, operators) {
      return operators.eq(fields.userId, inputs.placeholders.userId)
    },
  })

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
