import { and, InferSelectModel, type InferInsertModel } from "drizzle-orm"
import { TDatabaseLike } from "../../types"
import { webhook } from "../../schema"
import { eq, sql } from "drizzle-orm"

export type UpdateInput = Readonly<{
  data: Readonly<
    Pick<
      InferInsertModel<typeof webhook>,
      "url" | "maxBlocks" | "timeoutMs" | "maxRetries"
    >
  >
  where: Pick<InferSelectModel<typeof webhook>, "id" | "customerId">
}>

export const update = async (db: TDatabaseLike, args: UpdateInput) => {
  const inputs = {
    placeholders: {
      id: sql.placeholder(webhook.id.name).getSQL(),
      customerId: sql.placeholder(webhook.customerId.name).getSQL(),
      maxRetries: sql.placeholder(webhook.maxRetries.name).getSQL(),
      maxBlocks: sql.placeholder(webhook.maxBlocks.name).getSQL(),
      timeoutMs: sql.placeholder(webhook.timeoutMs.name).getSQL(),
      url: sql.placeholder(webhook.url.name).getSQL(),
    },
    values: {
      [webhook.id.name]: args.where.id,
      [webhook.customerId.name]: args.where.customerId,
      [webhook.maxRetries.name]: args.data.maxRetries,
      [webhook.maxBlocks.name]: args.data.maxBlocks,
      [webhook.timeoutMs.name]: args.data.timeoutMs,
      [webhook.url.name]: args.data.url,
    },
  }

  return await db
    .update(webhook)
    .set({
      maxRetries: inputs.placeholders.maxRetries,
      maxBlocks: inputs.placeholders.maxBlocks,
      timeoutMs: inputs.placeholders.timeoutMs,
      url: inputs.placeholders.url,
    })
    .where(
      and(
        eq(webhook.id, inputs.placeholders.id),
        eq(webhook.customerId, inputs.placeholders.customerId),
      ),
    )
    .prepare()
    .execute(inputs.values)
}
