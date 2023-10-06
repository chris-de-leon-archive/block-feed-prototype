import { CONSTANTS, createClient, getPreparedStmtName } from "../../core"
import { type InferSelectModel } from "drizzle-orm"
import { TRowLimit, TRowOffset } from "../../types"
import { subscriptions } from "../../schema"
import { sql } from "drizzle-orm"

export type FindManyInput = Readonly<
  Pick<InferSelectModel<typeof subscriptions>, "userId"> &
    TRowLimit &
    TRowOffset
>

export const findMany = async (
  db: ReturnType<typeof createClient>,
  args: FindManyInput
) => {
  const inputs = {
    placeholders: {
      userId: sql.placeholder(subscriptions.userId.name),
      limit: sql.placeholder(CONSTANTS.LIMIT),
      offset: sql.placeholder(CONSTANTS.OFFSET),
    },
    values: {
      [subscriptions.userId.name]: args.userId,
      [CONSTANTS.LIMIT]: args.limit,
      [CONSTANTS.OFFSET]: args.offset,
    },
  }

  const query = db.query.subscriptions.findMany({
    where(fields, operators) {
      return operators.eq(fields.userId, inputs.placeholders.userId)
    },
    with: {
      // TODO: null?
      webhookSubscription: true,
      emailSubscription: true,
    },
  })

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
