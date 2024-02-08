import { type InferInsertModel } from "drizzle-orm"
import { TDatabaseLike } from "../../types"
import { randomUUID } from "node:crypto"
import { webhook } from "../../schema"
import { sql } from "drizzle-orm"

export type CreateInput = Readonly<{
  data: Readonly<InferInsertModel<typeof webhook>>
}>

export const create = async (db: TDatabaseLike, args: CreateInput) => {
  const id = args.data.id ?? randomUUID()

  const inputs = {
    placeholders: {
      id: sql.placeholder(webhook.id.name).getSQL(),
      url: sql.placeholder(webhook.url.name).getSQL(),
      maxBlocks: sql.placeholder(webhook.maxBlocks.name).getSQL(),
      maxRetries: sql.placeholder(webhook.maxRetries.name).getSQL(),
      timeoutMs: sql.placeholder(webhook.timeoutMs.name).getSQL(),
      customerId: sql.placeholder(webhook.customerId.name).getSQL(),
      blockchainId: sql.placeholder(webhook.blockchainId.name).getSQL(),
    },
    values: {
      [webhook.id.name]: id,
      [webhook.url.name]: args.data.url,
      [webhook.maxBlocks.name]: args.data.maxBlocks,
      [webhook.maxRetries.name]: args.data.maxRetries,
      [webhook.timeoutMs.name]: args.data.timeoutMs,
      [webhook.customerId.name]: args.data.customerId,
      [webhook.blockchainId.name]: args.data.blockchainId,
    },
  }

  const query = db.insert(webhook).values({
    id: inputs.placeholders.id,
    url: inputs.placeholders.url,
    maxBlocks: inputs.placeholders.maxBlocks,
    maxRetries: inputs.placeholders.maxRetries,
    timeoutMs: inputs.placeholders.timeoutMs,
    customerId: inputs.placeholders.customerId,
    blockchainId: inputs.placeholders.blockchainId,
  })

  return await query
    .prepare("webhook:create")
    .execute(inputs.values)
    .then((result) => {
      if (result.rowCount == null || result.rowCount === 0) {
        return {
          id: null,
          data: result.rowCount ?? 0,
        }
      }
      return {
        id,
        data: result.rowCount,
      }
    })
}
