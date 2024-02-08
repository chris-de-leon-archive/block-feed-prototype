import { type InferSelectModel } from "drizzle-orm"
import { TDatabaseLike } from "../../types"
import { blockchain } from "../../schema"
import { sql } from "drizzle-orm"

export type FindOneInput = Readonly<{
  where: Readonly<Pick<InferSelectModel<typeof blockchain>, "id">>
}>

export const findOne = async (db: TDatabaseLike, args: FindOneInput) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(blockchain.id.name).getSQL(),
    },
    values: {
      [blockchain.id.name]: args.where.id,
    },
  }

  return await db.query.blockchain
    .findFirst({
      where(fields, operators) {
        return operators.eq(fields.id, inputs.placeholders.id)
      },
    })
    .prepare("blockchain:find-one")
    .execute(inputs.values)
}
