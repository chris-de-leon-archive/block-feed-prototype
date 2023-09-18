import { getTableColumns, getTableName, sql } from "drizzle-orm"
import { NodePgDatabase } from "drizzle-orm/node-postgres"
import { BlockMessage } from "../types/block-message.type"
import { IBlockchain } from "../types/blockchain.type"
import { database } from "@api/shared/database"
import { Channel, Connection } from "amqplib"
import { getEnvVars } from "./get-env-vars"
import { utils } from "@api/shared/utils"

export class BlockProducer {
  private readonly env: ReturnType<typeof getEnvVars>

  constructor(
    private readonly blockchain: IBlockchain,
    private readonly rmq: Connection,
    private readonly db: NodePgDatabase<typeof database.schema>
  ) {
    this.env = getEnvVars()
  }

  private async poll(channel: Channel) {
    // Get the name of the chain
    const chainInfo = this.blockchain.getInfo()

    // Make sure the queue exists
    await channel.assertQueue(chainInfo.id)

    // Get the latest block on this chain
    const latestBlockHeight = await this.blockchain.getLatestBlockHeight()

    // Find the cursor associated with this chain
    const result = await database.queries.blockCursor.findOne(this.db, {
      id: chainInfo.id,
    })

    // If there is no cursor for this chain, create one
    if (result == null) {
      return await database.queries.blockCursor.create(this.db, {
        networkURL: chainInfo.networkURL,
        blockchain: chainInfo.name,
        height: latestBlockHeight,
        id: chainInfo.id,
      })
    }

    // If we're up to date, then do nothing
    if (result.height > latestBlockHeight) {
      return
    }

    // If we're not up to date, get the block data
    const block = await this.blockchain.getBlockAtHeight(result.height)

    // Estimate the total number of functions in the database
    const funcsTableCols = getTableColumns(database.schema.funcs)
    const count = await database.queries.common.fastCount(this.db, {
      schema: database.schema.blockFeed.schemaName,
      table: getTableName(database.schema.funcs),
      filters: sql`${sql.identifier(funcsTableCols.cursorId.name)} = ${
        chainInfo.id
      }`,
    })

    // Send the block data to rabbitmq in batches
    const batches = Math.floor(count / this.env.maxFuncsPerConsumer) + 1
    for (let i = 0; i < batches; i++) {
      const msg: BlockMessage = {
        cursorId: chainInfo.id,
        data: block,
        pagination: {
          limit: this.env.maxFuncsPerConsumer,
          offset: i * this.env.maxFuncsPerConsumer,
        },
      }
      channel.sendToQueue(
        chainInfo.id,
        Buffer.from(JSON.stringify(msg, null, 2))
      )
    }

    // Update the cursor and return
    return await database.queries.blockCursor.update(this.db, {
      id: result.id,
      height: result.height + 1,
    })
  }

  public async run(ms: number) {
    this.poll.bind(this)
    const channel = await this.rmq.createChannel()
    const interval = setInterval(async () => {
      try {
        await this.poll(channel)
      } catch (error) {
        console.error(error)
      }
    }, ms)
    utils.onShutdown(() => {
      clearInterval(interval)
    })
  }
}
