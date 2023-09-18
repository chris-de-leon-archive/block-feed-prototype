import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda"
import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { BlockMessage } from "../types/block-message.type"
import { IBlockchain } from "../types/blockchain.type"
import { database } from "@api/shared/database"
import { Connection } from "amqplib"

export class BlockConsumer {
  constructor(
    private readonly blockchain: IBlockchain,
    private readonly rmq: Connection,
    private readonly db: NodePgDatabase<typeof database.schema>,
    private readonly lambda: LambdaClient
  ) {}

  private async onMessage(msg: BlockMessage) {
    // Fetches a batch of rows
    const rows = await database.queries.funcs.findManyByCursorId(this.db, {
      cursorId: msg.cursorId,
      limit: msg.pagination.limit,
      offset: msg.pagination.offset,
    })

    // Constructs an array of promises that each invoke a lambda function
    const promises = rows.map(async (r) => {
      return await this.lambda.send(
        new InvokeCommand({
          FunctionName: r.name,
          InvocationType: "Event",
          LogType: "None",
          Payload: JSON.stringify(msg.data),
        })
      )
    })

    // Invokes all lambda functions in parallel
    const settled = await Promise.allSettled(promises)
    settled.forEach((s, i) => {
      if (s.status === "rejected") {
        console.error(`Invocation failed: ${s.reason}\n\nFunction:\n${rows[i]}`)
      }
    })
  }

  public async run() {
    const chainInfo = this.blockchain.getInfo()
    const channel = await this.rmq.createChannel()
    await channel.assertQueue(chainInfo.id)
    await channel.consume(
      chainInfo.id,
      async (msg) => {
        if (msg != null) {
          await this.onMessage(JSON.parse(msg.content.toString()))
        }
      },
      {
        noAck: true,
      }
    )
  }
}
