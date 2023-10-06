import { CONSTANTS, createClient, getPreparedStmtName } from "../../core"
import { TRowLimit, TRowOffset } from "../../types"
import { InferSelectModel } from "drizzle-orm"
import { subscriptions } from "../../schema"
import { sql } from "drizzle-orm"

export type FindManyByCursorIdInput = Readonly<
  Pick<InferSelectModel<typeof subscriptions>, "cursorId"> &
    TRowLimit &
    TRowOffset
>

export const findManyByCursorId = async (
  db: ReturnType<typeof createClient>,
  args: FindManyByCursorIdInput
) => {
  const inputs = {
    placeholders: {
      cursorId: sql.placeholder(subscriptions.cursorId.name),
      limit: sql.placeholder(CONSTANTS.LIMIT),
      offset: sql.placeholder(CONSTANTS.OFFSET),
    },
    values: {
      [subscriptions.cursorId.name]: args.cursorId,
      [CONSTANTS.LIMIT]: args.limit,
      [CONSTANTS.OFFSET]: args.offset,
    },
  }

  const query = db.query.subscriptions.findMany({
    where(fields, operators) {
      return operators.eq(fields.cursorId, inputs.placeholders.cursorId)
    },
    with: {
      webhookSubscription: true,
      emailSubscription: true,
    },
    limit: inputs.placeholders.limit,
    offset: inputs.placeholders.offset,
  })

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
