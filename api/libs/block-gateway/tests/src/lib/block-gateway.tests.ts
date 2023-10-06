import { FlowBlockchain } from "@api/block-gateway/core/blockchains/flow"
import { blockconsumer } from "@api/block-gateway/core/block-consumer"
import { blockfetcher } from "@api/block-gateway/core/block-fetcher"
import { blockdivider } from "@api/block-gateway/core/block-divider"
import { blockwebhook } from "@api/block-gateway/core/block-webhook"
import { blocklogger } from "@api/block-gateway/core/block-logger"
import { blockmailer } from "@api/block-gateway/core/block-mailer"
import { after, before, describe, it } from "node:test"
import { SESClient } from "@aws-sdk/client-ses"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import { randomUUID } from "node:crypto"
import { flow } from "@api/shared/flow"
import { aws } from "@api/shared/aws"
import * as http from "node:http"
import assert from "node:assert"

describe("Block Gateway Tests", () => {
  const env = {
    blockconsumer: blockconsumer.getEnvVars(),
    blockdivider: blockdivider.getEnvVars(),
    blockfetcher: blockfetcher.getEnvVars(),
    blockwebhook: blockwebhook.getEnvVars(),
    blocklogger: blocklogger.getEnvVars(),
    blockmailer: blockmailer.getEnvVars(),
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
  const ses = new SESClient(env.aws)
  const services = {
    blockFetcher: new blockfetcher.BlockFetcher(env.blockfetcher, blockchain),
    blockWebhook: new blockwebhook.BlockWebhook(env.blockwebhook),
    blockMailer: new blockmailer.BlockMailer(env.blockmailer, ses),
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
      database.core.createClient(env.blockconsumer.BLOCK_CONSUMER_DB_URL)
    ),
  }

  const serverHost = "localhost"
  const serverPort = 3000
  const server = http.createServer((request, response) => {
    if (request.method === "POST" && request.url === "/") {
      let body = ""
      request
        .on("data", (chunk) => {
          body = body.concat(chunk)
        })
        .on("end", () => {
          response
            .setHeader("Content-Type", "application/json")
            .end(JSON.stringify(body, null, 2))
        })
    } else {
      response
        .writeHead(404, { "Content-Type": "text/plain" })
        .end("Not Found\n")
    }
  })

  before(async () => {
    // Wipes the database data
    process.stdout.write("Wiping database... ")
    await testutils.wipeDB(dbAdmin, database.schema.blockFeed.schemaName)
    console.log("done!")

    // Wipes the redis data
    process.stdout.write("Wiping redis... ")
    await testutils.wipeRedis()
    console.log("done!")

    // Creates testing data in the database
    process.stdout.write("Creating test data in database... ")
    const chainInfo = blockchain.getInfo()
    const userId = randomUUID()
    const sub1Id = randomUUID()
    const sub2Id = randomUUID()
    await dbAdmin.transaction(async (tx) => {
      await database.queries.blockCursor.create(tx, {
        id: chainInfo.id,
        blockchain: chainInfo.name,
        networkURL: chainInfo.networkURL,
      })
      await tx.insert(database.schema.users).values({
        id: userId,
      })
      await tx.insert(database.schema.subscriptions).values({
        id: sub1Id,
        name: `Test Subscription (${sub1Id})`,
        cursorId: chainInfo.id,
        userId: userId,
      })
      await tx.insert(database.schema.webhookSubscriptions).values({
        subscriptionId: sub1Id,
        url: `http://${serverHost}:${serverPort}`,
        method: database.schema.SubscriptionMethod.WEBHOOK,
        attempts: 1,
      })
      await tx.insert(database.schema.subscriptions).values({
        id: sub2Id,
        name: `Test Subscription (${sub2Id})`,
        cursorId: chainInfo.id,
        userId: userId,
      })
      await tx.insert(database.schema.webhookSubscriptions).values({
        subscriptionId: sub2Id,
        url: `http://${serverHost}:${serverPort}`,
        method: database.schema.SubscriptionMethod.WEBHOOK,
        attempts: 1,
      })
    })
    console.log("done!")

    // Starts a test server for webhook
    process.stdout.write("Starting test server for webhook... ")
    await new Promise<void>((res) => {
      server.listen(serverPort, serverHost, () => {
        res()
      })
    })
    console.log("done!")

    // Starts all services except the block fetcher
    process.stdout.write("Starting services... ")
    await services.blockConsumer.start()
    await services.blockDivider.start()
    await services.blockWebhook.start()
    await services.blockLogger.start()
    await services.blockMailer.start()
    await testutils.sleep(2000)
    console.log("done!\n")
  })

  after(async () => {
    // Stops all services
    services.blockConsumer != null && (await services.blockConsumer.stop())
    services.blockDivider != null && (await services.blockDivider.stop())
    services.blockFetcher != null && (await services.blockFetcher.stop())
    services.blockWebhook != null && (await services.blockWebhook.stop())
    services.blockLogger != null && (await services.blockLogger.stop())
    services.blockMailer != null && (await services.blockMailer.stop())
    await new Promise<void>((res) => {
      server.close(() => {
        res()
      })
    })
  })

  describe("Integration Tests", () => {
    before(async () => {
      // Starts job processing
      await services.blockFetcher.start()
      console.log("Waiting for jobs to be processed:\n")
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

    console.log(JSON.stringify(invocations, null, 2))

    // const actual = first
    // const expected = 200
    // assert.equal(
    //   actual,
    //   expected,
    //   `expected status code to equal ${expected} but received ${actual}`
    // )
  })
})
