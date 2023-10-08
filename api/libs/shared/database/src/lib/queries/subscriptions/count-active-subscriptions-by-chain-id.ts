import { createClient, getPreparedStmtName } from "../../core"
import { eq, type InferInsertModel } from "drizzle-orm"
import { sql } from "drizzle-orm"
import {
  webhookSubscriptions,
  emailSubscriptions,
  subscriptions,
} from "../../schema"

export type CountActiveSubscriptionsByChainIdInput = Readonly<
  Pick<InferInsertModel<typeof subscriptions>, "chainId">
>

export const countActiveSubscriptionsByChainId = async (
  db: ReturnType<typeof createClient>,
  args: CountActiveSubscriptionsByChainIdInput
) => {
  const inputs = {
    placeholders: {
      chainId: sql.placeholder(subscriptions.chainId.name),
    },
    values: {
      [subscriptions.chainId.name]: args.chainId,
    },
  }

  // Using one query will ensure that both counts are on the
  // same snapshot of the data
  const query = db
    .select({
      activeWebhookSubscriptions: sql<number>`COUNT(${webhookSubscriptions.id}) FILTER (WHERE ${webhookSubscriptions.isActive})`,
      activeEmailSubscriptions: sql<number>`COUNT(${emailSubscriptions.id}) FILTER (WHERE ${emailSubscriptions.isActive})`,
    })
    .from(subscriptions)
    .leftJoin(
      webhookSubscriptions,
      eq(subscriptions.id, webhookSubscriptions.subscriptionId)
    )
    .leftJoin(
      emailSubscriptions,
      eq(subscriptions.id, emailSubscriptions.subscriptionId)
    )
    .where(eq(subscriptions.chainId, inputs.placeholders.chainId))
    .limit(1)

  const name = getPreparedStmtName(query.toSQL().sql)
  return await query
    .prepare(name)
    .execute(inputs.values)
    .then(
      (rows) =>
        rows.at(0) ?? {
          activeWebhookSubscriptions: 0,
          activeEmailSubscriptions: 0,
        }
    )
}
