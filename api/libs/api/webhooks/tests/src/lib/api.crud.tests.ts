import { after, before, describe, it } from "node:test"
import { WebhooksAPI } from "@api/api/webhooks/api"
import * as testcontainers from "testcontainers"
import { testutils } from "@api/shared/testing"
import { redis } from "@api/shared/redis"
import { db } from "@api/shared/database"
import { auth0 } from "@api/shared/auth0"
import { randomUUID } from "node:crypto"
import { trpc } from "@api/shared/trpc"
import { AxiosError } from "axios"
import assert from "node:assert"

const t = trpc.createTRPC<any>()

const router = t.router({
  [WebhooksAPI.NAMESPACE]: t.router({
    [WebhooksAPI.OPERATIONS.FIND_MANY.NAME]: WebhooksAPI.findMany(t),
    [WebhooksAPI.OPERATIONS.ACTIVATE.NAME]: WebhooksAPI.activate(t),
    [WebhooksAPI.OPERATIONS.FIND_ONE.NAME]: WebhooksAPI.findOne(t),
    [WebhooksAPI.OPERATIONS.CREATE.NAME]: WebhooksAPI.create(t),
    [WebhooksAPI.OPERATIONS.REMOVE.NAME]: WebhooksAPI.remove(t),
    [WebhooksAPI.OPERATIONS.UPDATE.NAME]: WebhooksAPI.update(t),
  }),
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
  let ctx: WebhooksAPI.ActivateContext & WebhooksAPI.Context
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
    adminDbUrl = testutils.containers.db.getRootRoleUrl(databaseC)
    apiDbUrl = testutils.containers.db.getApiRoleUrl(databaseC)
    redisUrl = testutils.containers.redis.getRedisUrl(redisC)

    // Creates a TRPC context
    ctx = {
      auth0: auth0.core.createClient(auth0.core.zAuthEnv.parse(process.env)),
      redis: redis.core.createClient({ REDIS_URL: redisUrl }),
      database: db.core.createClient({
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
    auth0User = await testutils.createAuth0User(ctx.auth0)
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
          ctx.database.pool.end((err) => {
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
        {
          ...data,
          id: id,
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
      .webhooksActivate(
        {
          id: id,
        },
        { headers },
      )
      .then((result) => {
        assert.equal(result.data.queued, true)
      })
      .catch(testutils.handleAxiosError)

    // Should not be able to activate a nonexistent webhook
    await sdk
      .webhooksActivate(
        {
          id: randomUUID(),
        },
        { headers },
      )
      .catch((err) => {
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
      .webhooksRemove({ id }, { headers })
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
