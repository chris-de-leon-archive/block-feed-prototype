import { type InferSelectModel } from "drizzle-orm"
import { TDatabaseLike } from "../../types"
import { blockCache } from "../../schema"
import { sql } from "drizzle-orm"

export type FindOneInput = Readonly<{
  where: Readonly<Pick<InferSelectModel<typeof blockCache>, "blockchainId">>
}>

export const findLatestBlock = async (
  db: TDatabaseLike,
  args: FindOneInput,
) => {
  const inputs = {
    placeholders: {
      blockchainId: sql.placeholder(blockCache.blockchainId.name).getSQL(),
    },
    values: {
      [blockCache.blockchainId.name]: args.where.blockchainId,
    },
  }

  return await db.query.blockCache
    .findFirst({
      where(fields, operators) {
        return operators.eq(
          fields.blockchainId,
          inputs.placeholders.blockchainId,
        )
      },
      orderBy(fields, operators) {
        return operators.desc(fields.blockHeight)
      },
    })
    .prepare("blockCache:find-latest-block")
    .execute(inputs.values)
}
