import { after, before, describe, it } from "node:test"
import { AxiosRequestConfig, AxiosError } from "axios"
import { randomInt, randomUUID } from "node:crypto"
import { WebhooksAPI } from "@api/api/webhooks/api"
import * as testcontainers from "testcontainers"
import { testutils } from "@api/shared/testing"
import { redis } from "@api/shared/redis"
import { db } from "@api/shared/database"
import { auth0 } from "@api/shared/auth0"
import { trpc } from "@api/shared/trpc"
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

describe("Auth Tests", () => {
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

  let appServer: Awaited<ReturnType<typeof testutils.createAsyncServer>>
  let databaseC: testcontainers.StartedTestContainer
  let redisC: testcontainers.StartedTestContainer
  let ctx: WebhooksAPI.ActivateContext & WebhooksAPI.Context
  let adminDbUrl: string
  let apiDbUrl: string
  let redisUrl: string

  const testFunctions = (sdk: ReturnType<typeof testutils.getApi>) => [
    {
      name: "create",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await sdk.webhooksCreate(
          {
            url: "http://fakeurl.com",
            maxRetries: 10,
            maxBlocks: 10,
            timeoutMs: 1000,
            blockchainId: blockchainId,
          },
          config,
        ),
    },
    {
      name: "activate",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await sdk.webhooksActivate({ id: randomUUID() }, config),
    },
    {
      name: "find many",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await sdk.webhooksFindMany(undefined, undefined, config),
    },
    {
      name: "find one",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await sdk.webhooksFindOne(randomUUID(), config),
    },
    {
      name: "update",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await sdk.webhooksUpdate(
          {
            id: randomUUID(),
            url: "http://does-not-matter.com",
            maxBlocks: randomInt(1, 10),
            maxRetries: randomInt(0, 10),
            timeoutMs: randomInt(1000, 5000),
          },
          config,
        ),
    },
    {
      name: "remove",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await sdk.webhooksRemove({ id: randomUUID() }, config),
    },
  ]

  const args = [
    {
      name: "bad token",
      error: "invalid access token",
      status: 401,
      headers: { headers: { Authorization: "bearer none" } },
    },
    {
      name: "no bearer",
      error: 'authorization header value is missing "bearer" prefix',
      status: 400,
      headers: { headers: { Authorization: "basic none" } },
    },
    {
      name: "no authorization header",
      error: "request is missing authorization header",
      status: 400,
      headers: { headers: {} },
    },
  ]

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
    const sdk = testutils.getApi({
      basePath: appServer.url,
    })

    await Promise.allSettled(
      testFunctions(sdk)
        .flatMap((f) => args.map((a) => ({ func: f, args: a })))
        .map(async (test) => {
          return await it(`${test.func.name} (${test.args.name})`, async () => {
            try {
              await test.func.call(test.args.headers)
            } catch (err) {
              if (err instanceof AxiosError) {
                assert.equal(err.response?.status, test.args.status)
                assert.equal(err.response?.data.message, test.args.error)
              } else {
                console.error(err)
                assert.fail()
              }
            }
          })
        }),
    )
  })
})
