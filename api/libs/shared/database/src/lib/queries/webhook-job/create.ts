import { type InferInsertModel } from "drizzle-orm"
import { TDatabaseLike } from "../../types"
import { webhookJob } from "../../schema"
import { sql } from "drizzle-orm"

export type CreateInput = Readonly<{
  data: Readonly<InferInsertModel<typeof webhookJob>>
}>

export const create = async (db: TDatabaseLike, args: CreateInput) => {
  const inputs = {
    placeholders: {
      blockHeight: sql.placeholder(webhookJob.blockHeight.name).getSQL(),
      webhookId: sql.placeholder(webhookJob.webhookId.name).getSQL(),
    },
    values: {
      [webhookJob.blockHeight.name]: args.data.blockHeight,
      [webhookJob.webhookId.name]: args.data.webhookId,
    },
  }

  const query = db.insert(webhookJob).values({
    blockHeight: inputs.placeholders.blockHeight,
    webhookId: inputs.placeholders.webhookId,
  })

  return await query
    .prepare("webhook-job:create")
    .execute(inputs.values)
    .then((result) => {
      return {
        data: result.rowCount ?? 0,
      }
    })
}
