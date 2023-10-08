import { CONSTANTS, createClient, getPreparedStmtName } from "../../core"
import { subscriptions, webhookSubscriptions } from "../../schema"
import { InferSelectModel, desc, eq } from "drizzle-orm"
import { TRowLimit, TRowOffset } from "../../types"
import { sql } from "drizzle-orm"

export type FindManyWebhookSubscriptionsByChainIdInput = Readonly<
  Pick<InferSelectModel<typeof subscriptions>, "chainId"> &
    Pick<InferSelectModel<typeof webhookSubscriptions>, "isActive"> &
    TRowLimit &
    TRowOffset
>

export const findManyWebhookSubscriptionsBychainId = async (
  db: ReturnType<typeof createClient>,
  args: FindManyWebhookSubscriptionsByChainIdInput
) => {
  const inputs = {
    placeholders: {
      isActive: sql.placeholder(webhookSubscriptions.isActive.name),
      chainId: sql.placeholder(subscriptions.chainId.name),
      limit: sql.placeholder(CONSTANTS.LIMIT),
      offset: sql.placeholder(CONSTANTS.OFFSET),
    },
    values: {
      [webhookSubscriptions.isActive.name]: args.isActive,
      [subscriptions.chainId.name]: args.chainId,
      [CONSTANTS.LIMIT]: args.limit,
      [CONSTANTS.OFFSET]: args.offset,
    },
  }

  const query = db
    .select()
    .from(webhookSubscriptions)
    .leftJoin(
      subscriptions,
      eq(subscriptions.id, webhookSubscriptions.subscriptionId)
    )
    .where(eq(webhookSubscriptions.isActive, inputs.placeholders.isActive))
    .limit(inputs.placeholders.limit)
    .offset(inputs.placeholders.offset)
    .orderBy(
      desc(webhookSubscriptions.createdAt),
      desc(webhookSubscriptions.id)
    )

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query.prepare(name).execute(inputs.values)
}
