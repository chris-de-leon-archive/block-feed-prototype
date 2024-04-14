import { stripe, redis, db, StripeVendor, clerk } from "@block-feed/vendors"
import { ClientError, RequestOptions } from "graphql-request"
import { after, before, describe, it } from "node:test"
import { randomInt, randomUUID } from "node:crypto"
import * as testcontainers from "testcontainers"
import * as schema from "@block-feed/drizzle"
import * as testutils from "../../utils"
import assert from "node:assert"
import Stripe from "stripe"
import {
  STRIPE_CHECKOUT_SESSION_CACHE_KEY_PREFIX,
  requireStripeSubscription,
  GraphQLContext,
  withClerkJWT,
  BaseContext,
  ApiCache,
} from "../../../src"

describe("Auth Tests", () => {
  const testCleaner = new testutils.TestCleaner()
  const webhookStreamName = "webhook-lb-stream"
  const blockchainId = "fake-blockchain"
  const cacheExpMs = 30000
  const fakeStripeEnv: StripeVendor["env"] = {
    STRIPE_WEBHOOK_SECRET: "dummy-webhook-secret",
    STRIPE_API_KEY: "dummy-api-key",
    STRIPE_PRICE_ID: "dummy-price-id",
    STRIPE_CHECKOUT_SUCCESS_URL: "http://dummy:3000",
    STRIPE_CHECKOUT_CANCEL_URL: "http://dummy:3000",
    STRIPE_BILLING_PORTAL_RETURN_URL: "http://dummy:3000",
    STRIPE_CUSTOMER_PORTAL_URL: "http://dummy:3000",
  }
  const verbose = {
    database: true,
    container: {
      errors: true,
      data: false,
    },
  }

  let appServer: Awaited<ReturnType<typeof testutils.createAsyncServer>>
  let redisCache: ReturnType<typeof redis.client.create>
  let databaseC: testcontainers.StartedTestContainer
  let redisC: testcontainers.StartedTestContainer
  let adminDbUrl: string
  let apiDbUrl: string
  let redisUrl: string
  let ctx: BaseContext

  const getFunctionsToTest = (sdk: ReturnType<typeof testutils.withSdk>) => [
    {
      name: "create",
      call: async (config: RequestOptions["requestHeaders"]) =>
        await sdk.CreateWebhook(
          {
            data: {
              url: "http://fakeurl.com",
              maxRetries: 10,
              maxBlocks: 10,
              timeoutMs: 1000,
              blockchainId: blockchainId,
            },
          },
          config,
        ),
    },
    {
      name: "activate",
      call: async (config: RequestOptions["requestHeaders"]) =>
        await sdk.ActivateWebhooks({ ids: [randomUUID()] }, config),
    },
    {
      name: "find many",
      call: async (config: RequestOptions["requestHeaders"]) =>
        await sdk.Webhooks(
          {
            filters: {},
            pagination: {
              limit: 10,
            },
          },
          config,
        ),
    },
    {
      name: "find one",
      call: async (config: RequestOptions["requestHeaders"]) =>
        await sdk.Webhook({ id: randomUUID() }, config),
    },
    {
      name: "update",
      call: async (config: RequestOptions["requestHeaders"]) =>
        await sdk.UpdateWebhook(
          {
            id: randomUUID(),
            data: {
              url: "http://does-not-matter.com",
              maxBlocks: randomInt(1, 10),
              maxRetries: randomInt(0, 10),
              timeoutMs: randomInt(1000, 5000),
            },
          },
          config,
        ),
    },
    {
      name: "remove",
      call: async (config: RequestOptions["requestHeaders"]) =>
        await sdk.RemoveWebhooks({ ids: [randomUUID()] }, config),
    },
  ]

  const args = [
    {
      name: "bad token",
      error:
        "Invalid JWT form. A JWT consists of three parts separated by dots. (reason=token-invalid, token-carrier=header)",
      status: 401,
      headers: { Authorization: "bearer none" },
    },
    {
      name: "no bearer",
      error: 'authorization header value is missing "bearer" prefix',
      status: 401,
      headers: { Authorization: "basic none" },
    },
    {
      name: "no authorization header",
      error: "request is missing authorization header",
      status: 401,
      headers: undefined,
    },
  ]

  before(async () => {
    try {
      // Creates containers
      process.stdout.write("Starting containers... ")
      ;[redisC, databaseC] = await Promise.all([
        testutils.containers.redis.spawn(verbose.container),
        testutils.containers.db.spawn(verbose.container),
      ])
      console.log("done!")

      // Schedule the containers for cleanup
      testCleaner.cleanUp([() => redisC.stop(), () => databaseC.stop()])

      // Assigns database urls
      adminDbUrl = testutils.containers.db.getRootUserUrl(databaseC)
      apiDbUrl = testutils.containers.db.getFrontendUserUrl(databaseC)
      redisUrl = testutils.containers.redis.getRedisUrl(redisC)

      // Seeds the database with some fake data
      await testutils.containers.db.withDatabaseConn(
        adminDbUrl,
        async ({ conn }) => {
          await conn.transaction(async (tx) => {
            // There's no need to add a user to the database
            // The middleware will take care of that automatically
            await tx.insert(schema.blockchain).values({
              id: blockchainId,
              url: "http://does-not-matter.com",
            })
          })
        },
      )

      // Creates a redis cache client
      redisCache = redis.client.create({
        REDIS_WEBHOOK_STREAM_NAME: webhookStreamName,
        REDIS_URL: redisUrl,
      })

      // Creates the API context
      ctx = {
        vendor: {
          stripe: stripe.client.create(fakeStripeEnv),
          clerk: clerk.client.create(clerk.client.zEnv.parse(process.env)),
          redisWebhookLB: redis.client.create({
            REDIS_WEBHOOK_STREAM_NAME: webhookStreamName,
            REDIS_URL: redisUrl,
          }),
          db: db.client.create({
            DB_LOGGING: verbose.database,
            DB_URL: apiDbUrl,
          }),
        },
        caches: {
          stripe: new ApiCache<Stripe.Response<Stripe.Checkout.Session>>(
            redisCache,
            cacheExpMs,
            STRIPE_CHECKOUT_SESSION_CACHE_KEY_PREFIX,
          ),
        },
        middlewares: {
          requireStripeSubscription,
        },
        env: {
          CACHE_EXP_SEC: cacheExpMs,
        },
      }

      // Schedule the context for cleanup
      testCleaner.cleanUp([
        () => redisCache.client.quit(),
        () => ctx.vendor.redisWebhookLB.client.quit(),
        () =>
          new Promise((res, rej) => {
            ctx.vendor.db.pool.end((err) => {
              if (err != null) {
                rej(err)
              }
              res(null)
            })
          }),
      ])

      // Creates a mock API server from the context
      appServer = await testutils.createAsyncServer({
        context: async (context) => {
          return {
            ...ctx,
            yoga: {
              request: context.request,
              params: context.params,
            },
          } satisfies GraphQLContext
        },
        plugins: [
          withClerkJWT({
            clerk: ctx.vendor.clerk,
            db: ctx.vendor.db,
          }),
        ],
      })

      // Schedule the server for cleanup
      testCleaner.cleanUp(() => appServer.close())
    } catch (err) {
      // The node test runner won't log any errors that occur in
      // the before hook and hangs when an issue is encountered
      console.error(err)
      throw err
    }
  })

  after(async () => {
    await testCleaner.clean(console.error)
  })

  it("Integration Test", async () => {
    const sdk = testutils.withSdk(`${appServer.url}/graphql`)
    await Promise.allSettled(
      getFunctionsToTest(sdk)
        .flatMap((f) => args.map((a) => ({ func: f, args: a })))
        .map(async (test) => {
          return await it(`${test.func.name} (${test.args.name})`, async () => {
            try {
              await test.func.call(test.args.headers)
            } catch (err) {
              if (err instanceof ClientError) {
                assert.equal(err.response.errors?.[0]?.message, test.args.error)
                assert.equal(err.response.status, test.args.status)
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
