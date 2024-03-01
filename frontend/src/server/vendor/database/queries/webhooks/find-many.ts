import { TDatabaseLike, TRowLimit, TRowOffset } from "../../types"
import { type InferSelectModel } from "drizzle-orm"
import { constants } from "../../constants"
import { webhook } from "../../schema"
import { sql } from "drizzle-orm"

export type FindManyInput = Readonly<{
  where: Readonly<Pick<InferSelectModel<typeof webhook>, "customerId">>
}> &
  TRowLimit &
  TRowOffset

export const findMany = async (db: TDatabaseLike, args: FindManyInput) => {
  const inputs = {
    placeholders: {
      customerId: sql.placeholder(webhook.customerId.name).getSQL(),
      limit: sql.placeholder(constants.LIMIT),
      offset: sql.placeholder(constants.OFFSET),
    },
    values: {
      [webhook.customerId.name]: args.where.customerId,
      [constants.LIMIT]: args.limit,
      [constants.OFFSET]: args.offset,
    },
  }

  return await db.query.webhook
    .findMany({
      where(fields, operators) {
        return operators.eq(fields.customerId, inputs.placeholders.customerId)
      },
      limit: inputs.placeholders.limit,
      offset: inputs.placeholders.offset,
      orderBy(fields, operators) {
        return [operators.desc(fields.createdAt), operators.desc(fields.id)]
      },
    })
    .prepare()
    .execute(inputs.values)
}
