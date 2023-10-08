import { CONSTANTS, createClient, getPreparedStmtName } from "../../core"
import { emailSubscriptions, subscriptions } from "../../schema"
import { InferSelectModel, desc, eq } from "drizzle-orm"
import { TRowLimit, TRowOffset } from "../../types"
import { sql } from "drizzle-orm"

export type FindManyEmailSubscriptionsByChainIdInput = Readonly<
  Pick<InferSelectModel<typeof subscriptions>, "chainId"> &
    Pick<InferSelectModel<typeof emailSubscriptions>, "isActive"> &
    TRowLimit &
    TRowOffset
>

export const findManyEmailSubscriptionsBychainId = async (
  db: ReturnType<typeof createClient>,
  args: FindManyEmailSubscriptionsByChainIdInput
) => {
  const inputs = {
    placeholders: {
      isActive: sql.placeholder(emailSubscriptions.isActive.name),
      chainId: sql.placeholder(subscriptions.chainId.name),
      limit: sql.placeholder(CONSTANTS.LIMIT),
      offset: sql.placeholder(CONSTANTS.OFFSET),
    },
    values: {
      [emailSubscriptions.isActive.name]: args.isActive,
      [subscriptions.chainId.name]: args.chainId,
      [CONSTANTS.LIMIT]: args.limit,
      [CONSTANTS.OFFSET]: args.offset,
    },
  }

  const query = db
    .select()
    .from(emailSubscriptions)
    .leftJoin(
      subscriptions,
      eq(subscriptions.id, emailSubscriptions.subscriptionId)
    )
    .where(eq(emailSubscriptions.isActive, inputs.placeholders.isActive))
    .limit(inputs.placeholders.limit)
    .offset(inputs.placeholders.offset)
    .orderBy(desc(emailSubscriptions.createdAt), desc(emailSubscriptions.id))

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
