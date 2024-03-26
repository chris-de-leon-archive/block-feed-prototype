import { Context } from "@block-feed/server/graphql/types"
import { db } from "@block-feed/server/vendor/database"
import { redis } from "@block-feed/server/vendor/redis"
import { after, before, describe, it } from "node:test"
import { auth } from "@block-feed/server/vendor/auth0"
import * as testcontainers from "testcontainers"
import * as schema from "@block-feed/drizzle"
import * as testutils from "../../utils"
import { randomUUID } from "node:crypto"
import assert from "node:assert"

describe("CRUD Tests", () => {
  const webhookStreamName = "webhook-lb-stream"
  const blockchainId = "fake-blockchain"
  const verbose = {
    database: true,
    container: {
      errors: true,
      data: false,
    },
  }

  let auth0User: Awaited<ReturnType<typeof testutils.createAuth0User>>
  let appServer: Awaited<ReturnType<typeof testutils.createAsyncServer>>
  let databaseC: testcontainers.StartedTestContainer
  let redisC: testcontainers.StartedTestContainer
  let adminDbUrl: string
  let apiDbUrl: string
  let redisUrl: string
  let ctx: Omit<Context, "yoga">
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
          await tx.insert(schema.blockchain).values({
            id: blockchainId,
            url: "http://does-not-matter.com",
          })
        })
      },
    )

    // Creates a mock API server from the context
    appServer = await testutils.createAsyncServer({
      context: async (context) => {
        return {
          ...ctx,
          yoga: {
            request: context.request,
            params: context.params,
          },
        } satisfies Context
      },
    })
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
    const sdk = testutils.withSdk(`${appServer.url}/graphql`)

    // Defines fake data
    const data = {
      url: "http://fakeurl.com",
      maxRetries: 10,
      maxBlocks: 10,
      timeoutMs: 1000,
    }

    // Creates an item in the database
    const id = await sdk
      .CreateWebhook(
        {
          data: {
            ...data,
            blockchainId: blockchainId,
          },
        },
        headers,
      )
      .then(({ data: { webhookCreate: result } }) => result.id)

    // Updates the item
    const newMaxBlocks = 1
    await sdk
      .UpdateWebhook(
        {
          id,
          data: {
            ...data,
            maxBlocks: newMaxBlocks,
          },
        },
        headers,
      )
      .then(({ data: { webhookUpdate: result } }) => {
        assert.notEqual(result.count, 0)
      })

    // The created item should exist and be updated
    await sdk.Webhook({ id }, headers).then(({ data: { webhook: result } }) => {
      assert.equal(result.id, id)
      assert.equal(result.isActive, 0)
      assert.equal(result.maxBlocks, newMaxBlocks)
    })

    // Activate with an empty list should trivially return 0
    await sdk
      .ActivateWebhooks({ ids: [] }, headers)
      .then(({ data: { webhookActivate: result } }) => {
        assert.equal(result.count, 0)
      })

    // Activating a nonexistent webhook should trivially return 0
    await sdk
      .ActivateWebhooks({ ids: [randomUUID()] }, headers)
      .then(({ data: { webhookActivate: result } }) => {
        assert.equal(result.count, 0)
      })

    // Activates the webhook
    await sdk
      .ActivateWebhooks({ ids: [id] }, headers)
      .then(({ data: { webhookActivate: result } }) => {
        assert.equal(result.count, 1)
      })

    // Remove with an empty list should trivially return 0
    await sdk
      .RemoveWebhooks({ ids: [] }, headers)
      .then(({ data: { webhookRemove: result } }) => {
        assert.equal(result.count, 0)
      })

    // Removing a nonexistent webhook should trivially return 0
    await sdk
      .RemoveWebhooks({ ids: [randomUUID()] }, headers)
      .then(({ data: { webhookRemove: result } }) => {
        assert.equal(result.count, 0)
      })

    // Removes the webhook
    await sdk
      .RemoveWebhooks({ ids: [id] }, headers)
      .then(({ data: { webhookRemove: result } }) => {
        assert.equal(result.count, 1)
      })

    // No results should be returned
    await sdk
      .Webhooks(
        {
          pagination: { limit: 10, cursor: null },
          filters: {},
        },
        headers,
      )
      .then(({ data: { webhooks: result } }) => {
        assert.equal(result.length, 0)
      })
  })
})
