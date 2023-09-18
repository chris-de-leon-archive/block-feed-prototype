import { CONSTANTS, createClient, getPreparedStmtName } from "../../core"
import { RowLimit, RowOffset } from "../../types"
import { InferSelectModel } from "drizzle-orm"
import { funcs } from "../../schema"
import { sql } from "drizzle-orm"

export type FindManyByCursorIdInput = Readonly<
  Pick<InferSelectModel<typeof funcs>, "cursorId"> & RowLimit & RowOffset
>

export const findManyByCursorId = async (
  db: ReturnType<typeof createClient>,
  args: FindManyByCursorIdInput
) => {
  const inputs = {
    placeholders: {
      cursorId: sql.placeholder(funcs.cursorId.name),
      limit: sql.placeholder(CONSTANTS.LIMIT),
      offset: sql.placeholder(CONSTANTS.OFFSET),
    },
    values: {
      [funcs.cursorId.name]: args.cursorId,
      [CONSTANTS.LIMIT]: args.limit,
      [CONSTANTS.OFFSET]: args.offset,
    },
  }

  const query = db.query.funcs.findMany({
    where(fields, operators) {
      return operators.eq(fields.cursorId, inputs.placeholders.cursorId)
    },
    limit: inputs.placeholders.limit,
    offset: inputs.placeholders.offset,
  })

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
