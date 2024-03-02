import { webhooks } from "@block-feed/server/routes/webhooks"
import { trpc, InnerContext } from "@block-feed/server/trpc"
import { db } from "@block-feed/server/vendor/database"
import { redis } from "@block-feed/server/vendor/redis"
import { after, before, describe, it } from "node:test"
import { auth } from "@block-feed/server/vendor/auth0"
import * as testcontainers from "testcontainers"
import * as testutils from "../../utils"
import { randomUUID } from "node:crypto"
import { AxiosError } from "axios"
import assert from "node:assert"

const router = trpc.router({
  [webhooks.namespace]: webhooks.router,
})

describe("CRUD Tests", () => {
  const webhookStreamName = "webhook-lb-stream"
  const blockchainId = "fake-blockchain"
  const verbose = {
    database: true,
    errors: false,
    container: {
      errors: true,
      data: false,
    },
  }

  let auth0User: Awaited<ReturnType<typeof testutils.createAuth0User>>
  let appServer: Awaited<ReturnType<typeof testutils.createAsyncServer>>
  let databaseC: testcontainers.StartedTestContainer
  let redisC: testcontainers.StartedTestContainer
  let ctx: InnerContext
  let adminDbUrl: string
  let apiDbUrl: string
  let redisUrl: string
  let headers = {}

  before(async () => {
    // Creates containers
    process.stdout.write("Starting containers... ")
    ;[redisC, databaseC] = await Promise.all([
      testutils.containers.redis.spawn(verbose.container),
      testutils.containers.db.spawn(verbose.container),
    ])
    console.log("done!")

    // Assigns database urls
    adminDbUrl = testutils.containers.db.getRootUserUrl(databaseC)
    apiDbUrl = testutils.containers.db.getFrontendUserUrl(databaseC)
    redisUrl = testutils.containers.redis.getRedisUrl(redisC)

    // Creates a TRPC context
    ctx = {
      auth: auth.client.create(auth.client.zEnv.parse(process.env)),
      redis: redis.client.create({ REDIS_URL: redisUrl }),
      db: db.client.create({
        DB_LOGGING: verbose.database,
        DB_MODE: "default",
        DB_URL: apiDbUrl,
      }),
      env: {
        WEBHOOK_REDIS_STREAM_NAME: webhookStreamName,
      },
    }

    // Creates an Auth0 user
    process.stdout.write("Creating Auth0 user... ")
    auth0User = await testutils.createAuth0User(ctx.auth)
    headers = { Authorization: `bearer ${auth0User.accessToken}` }
    console.log("done!")

    // Seeds the database with some fake data
    await testutils.containers.db.withDatabaseConn(
      adminDbUrl,
      async ({ conn }) => {
        await conn.transaction(async (tx) => {
          // NOTE: there's no need to add the auth0 user to the database
          // The middleware will take care of that automatically
          await tx.insert(db.schema.blockchain).values({
            id: blockchainId,
            url: "http://does-not-matter.com",
          })
        })
      },
    )

    // Creates a mock API server from the context
    appServer = await testutils.createAsyncServer(
      testutils.createMockApiServer(ctx, {
        router,
        onError: (opts) => {
          if (verbose.errors) {
            console.error(opts)
          }
        },
      }),
    )
  })

  after(async () => {
    await testutils.runPromisesInOrder(
      [
        appServer.close(),
        new Promise((res, rej) => {
          ctx.db.pool.end((err) => {
            if (err != null) {
              rej(err)
            }
            res(null)
          })
        }),
        ctx.redis.client.quit(),
        databaseC.stop(),
        redisC.stop(),
        auth0User?.cleanUp(),
      ],
      (err) => {
        // If one or more of the input promises fails, we do NOT want to
        // throw an error. Instead we log it and continue running the rest
        // of the promises to make sure the other resources get cleaned up
        console.error(err)
      },
    )
  })

  it("Integration Test", async () => {
    // Gets the OpenAPI SDK
    const sdk = testutils.getApi({
      basePath: appServer.url,
    })

    // Defines fake data
    const data = {
      url: "http://fakeurl.com",
      maxRetries: 10,
      maxBlocks: 10,
      timeoutMs: 1000,
      blockchainId: blockchainId,
    }

    // Creates an item in the database
    const id = await sdk
      .webhooksCreate(data, { headers })
      .then((result) => {
        const id = result.data.id
        if (id == null) {
          assert.fail("create failed")
        }
        return id
      })
      .catch(testutils.handleAxiosError)

    // Updates the item
    const newMaxBlocks = 1
    await sdk
      .webhooksUpdate(
        id,
        {
          ...data,
          maxBlocks: newMaxBlocks,
        },
        { headers },
      )
      .then((result) => {
        const count = result.data.count
        if (count === 0) {
          assert.fail("update failed")
        }
      })
      .catch(testutils.handleAxiosError)

    // The created item should exist and be updated
    await sdk
      .webhooksFindOne(id, { headers })
      .then((result) => {
        assert.equal(result.data.id, id)
        assert.equal(result.data.isActive, 0)
        assert.equal(result.data.maxBlocks, newMaxBlocks)
      })
      .catch(testutils.handleAxiosError)

    // Activates the webhook
    await sdk
      .webhooksActivate(id, { headers })
      .then((result) => {
        assert.equal(result.data.queued, true)
      })
      .catch(testutils.handleAxiosError)

    // Should not be able to activate a nonexistent webhook
    await sdk.webhooksActivate(randomUUID(), { headers }).catch((err) => {
      if (err instanceof AxiosError) {
        assert.equal(err.response?.status, 400)
        assert.equal(err.response?.data.message, "webhook does not exist")
      } else {
        console.error(err)
        assert.fail()
      }
    })

    // Removes the webhook
    await sdk
      .webhooksRemove(id, { headers })
      .then((result) => {
        assert.equal(result.data.count, 1)
      })
      .catch(testutils.handleAxiosError)

    // No results should be returned
    await sdk
      .webhooksFindMany(undefined, undefined, { headers })
      .then((result) => {
        assert.equal(result.data.length, 0)
      })
      .catch(testutils.handleAxiosError)
  })
})
