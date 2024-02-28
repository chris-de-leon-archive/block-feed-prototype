import { and, type InferSelectModel } from "drizzle-orm"
import { TDatabaseLike } from "../../types"
import { webhook } from "../../schema"
import { eq, sql } from "drizzle-orm"

export type RemoveInput = Readonly<{
  where: Readonly<Pick<InferSelectModel<typeof webhook>, "id" | "customerId">>
}>

export const remove = async (db: TDatabaseLike, args: RemoveInput) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(webhook.id.name).getSQL(),
      customerId: sql.placeholder(webhook.customerId.name).getSQL(),
    },
    values: {
      [webhook.id.name]: args.where.id,
      [webhook.customerId.name]: args.where.customerId,
    },
  }

  return await db
    .delete(webhook)
    .where(
      and(
        eq(webhook.id, inputs.placeholders.id),
        eq(webhook.customerId, inputs.placeholders.customerId),
      ),
    )
    .prepare()
    .execute(inputs.values)
}
