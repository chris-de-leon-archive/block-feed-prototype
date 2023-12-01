import { CONSTANTS, createClient } from "../../core"
import { type InferSelectModel } from "drizzle-orm"
import { TRowLimit, TRowOffset } from "../../types"
import { relayers } from "../../schema"
import { sql } from "drizzle-orm"

export type FindManyInput = Readonly<{
  where: Readonly<Pick<InferSelectModel<typeof relayers>, "userId">>
}> &
  TRowLimit &
  TRowOffset

export const findMany = async (
  db: ReturnType<typeof createClient>,
  args: FindManyInput,
) => {
  const inputs = {
    placeholders: {
      userId: sql.placeholder(relayers.userId.name).getSQL(),
      limit: sql.placeholder(CONSTANTS.LIMIT),
      offset: sql.placeholder(CONSTANTS.OFFSET),
    },
    values: {
      [relayers.userId.name]: args.where.userId,
      [CONSTANTS.LIMIT]: args.limit,
      [CONSTANTS.OFFSET]: args.offset,
    },
  }

  return await db.drizzle.query.relayers
    .findMany({
      where(fields, operators) {
        return operators.eq(fields.userId, inputs.placeholders.userId)
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
