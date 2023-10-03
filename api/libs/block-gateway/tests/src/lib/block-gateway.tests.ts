import { FlowBlockchain } from "@api/block-gateway/core/blockchains/flow"
import { blockconsumer } from "@api/block-gateway/core/block-consumer"
import { blockfetcher } from "@api/block-gateway/core/block-fetcher"
import { blockdivider } from "@api/block-gateway/core/block-divider"
import { blocklogger } from "@api/block-gateway/core/block-logger"
import { after, before, describe, it } from "node:test"
import { LambdaClient } from "@aws-sdk/client-lambda"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import { IAMClient } from "@aws-sdk/client-iam"
import { randomUUID } from "node:crypto"
import { flow } from "@api/shared/flow"
import { aws } from "@api/shared/aws"
import assert from "node:assert"

describe("Block Gateway Tests", () => {
  const env = {
    blockconsumer: blockconsumer.getEnvVars(),
    blockdivider: blockdivider.getEnvVars(),
    blockfetcher: blockfetcher.getEnvVars(),
    blocklogger: blocklogger.getEnvVars(),
    db: database.core.getEnvVars(),
    aws: (() => {
      const env = aws.core.getEnvVars()
      return {
        endpoint: env.AWS_ENDPOINT,
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
        region: env.AWS_REGION,
      }
    })(),
  }

  const dbAdmin = database.core.createClient(env.db.DB_URL)
  const blockchain = new FlowBlockchain(flow.createClient())
  const lambda = new LambdaClient(env.aws)
  const iam = new IAMClient(env.aws)
  const services = {
    blockFetcher: new blockfetcher.BlockFetcher(env.blockfetcher, blockchain),
    blockDivider: new blockdivider.BlockDivider(
      env.blockdivider,
      database.core.createClient(env.blockdivider.BLOCK_DIVIDER_DB_URL)
    ),
    blockLogger: new blocklogger.BlockLogger(
      env.blocklogger,
      database.core.createClient(env.blocklogger.BLOCK_LOGGER_DB_URL)
    ),
    blockConsumer: new blockconsumer.BlockConsumer(
      env.blockconsumer,
      database.core.createClient(env.blockconsumer.BLOCK_CONSUMER_DB_URL),
      lambda
    ),
  }

  before(async () => {
    // Wipes the database data
    process.stdout.write("Wiping database... ")
    await testutils.wipeDB(dbAdmin, database.schema.blockFeed.schemaName)
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
    await dbAdmin.transaction(async (tx) => {
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

      // Create and process jobs
      console.log("Waiting for data to be processed:\n")
      await testutils.sleep(6000)
      console.log()

      // Stops the block fetcher from creating new jobs
      // and waits for any remaining jobs to be processed
      await services.blockFetcher.stop()
      await testutils.sleep(6000)
    })
  })

  it("Processes messages", async () => {
    const invocations = await dbAdmin
      .select()
      .from(database.schema.invocationLog)

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
