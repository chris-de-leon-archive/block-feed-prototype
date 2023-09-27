import { FlowBlockchain } from "@api/block-gateway/core/blockchains/flow"
import { blockconsumer } from "@api/block-gateway/core/block-consumer"
import { blockfetcher } from "@api/block-gateway/core/block-fetcher"
import { blockdivider } from "@api/block-gateway/core/block-divider"
import { blocklogger } from "@api/block-gateway/core/block-logger"
import { after, before, describe, it } from "node:test"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import { randomUUID } from "node:crypto"
import { flow } from "@api/shared/flow"
import { aws } from "@api/shared/aws"
import assert from "node:assert"

describe("Block Gateway Tests", () => {
  const blockchain = new FlowBlockchain(flow.createClient())
  const lambda = aws.lambda.createClient()
  const db = database.core.createClient()
  const iam = aws.iam.createClient()
  const services = {
    blockDivider: new blockdivider.BlockDivider(blockdivider.getEnvVars(), db),
    blockLogger: new blocklogger.BlockLogger(blocklogger.getEnvVars(), db),
    blockConsumer: new blockconsumer.BlockConsumer(
      blockconsumer.getEnvVars(),
      db,
      lambda
    ),
    blockFetcher: new blockfetcher.BlockFetcher(
      blockfetcher.getEnvVars(),
      blockchain
    ),
  }

  before(async () => {
    // Wipes the database data
    process.stdout.write("Wiping database... ")
    await testutils.wipeDB(db, database.schema.blockFeed.schemaName)
    console.log("done!")

    // Wipes the redis data
    process.stdout.write("Wiping redis... ")
    await testutils.wipeRedis()
    console.log("done!")

    // Starts all services except the block cursor
    process.stdout.write("Starting services... ")
    await services.blockConsumer.start()
    await services.blockDivider.start()
    await services.blockLogger.start()
    console.log("done!")

    // Creates a lambda function
    process.stdout.write("Creating a lambda function... ")
    const lambdaId = await testutils
      .createLambda(
        iam,
        lambda,
        `exports.handler = async (event, context) => {
          console.log(JSON.stringify(event, null, 2))
          return event
        };`
      )
      .then((res) => res.id)
    console.log("done!")

    // Creates testing data in the database
    process.stdout.write("Creating test data in database... ")
    const chainInfo = blockchain.getInfo()
    const userId = randomUUID()
    await db.transaction(async (tx) => {
      await database.queries.blockCursor.create(tx, {
        id: chainInfo.id,
        blockchain: chainInfo.name,
        networkURL: chainInfo.networkURL,
      })
      await tx.insert(database.schema.users).values({
        id: userId,
      })
      await tx.insert(database.schema.funcs).values({
        name: lambdaId,
        cursorId: chainInfo.id,
        userId: userId,
      })
    })
    console.log("done!")
  })

  after(async () => {
    // Stops all services
    services.blockConsumer != null && (await services.blockConsumer.stop())
    services.blockDivider != null && (await services.blockDivider.stop())
    services.blockFetcher != null && (await services.blockFetcher.stop())
    services.blockLogger != null && (await services.blockLogger.stop())
  })

  describe("Integration Tests", () => {
    before(async () => {
      // Starts the block cursor
      process.stdout.write("Starting block fetcher... ")
      await services.blockFetcher.start()
      console.log("done!")

      // Waits for the block fetcher to create jobs
      process.stdout.write("Adding jobs... ")
      await testutils.sleep(5000)
      console.log("done!")

      // Stops the block fetcher from creating new jobs
      process.stdout.write("Stopping block fetcher... ")
      await services.blockFetcher.stop()
      console.log("done!")

      // Waits for jobs to be processed
      process.stdout.write("Waiting for jobs to be processed... ")
      await testutils.sleep(5000)
      console.log("done!")
    })
  })

  it("Processes messages", async () => {
    const invocations = await db.select().from(database.schema.invocationLog)

    const first = invocations.at(0)
    if (first == null) {
      assert.fail("no invocations were logged to the database")
    }

    const actual = first.statusCode
    const expected = 200
    assert.equal(
      actual,
      expected,
      `expected statusCode to equal ${expected} but received ${actual}`
    )
  })
})
