import { stripe, redis, db, StripeVendor, clerk } from "@block-feed/vendors"
import { after, before, describe, it } from "node:test"
import * as testcontainers from "testcontainers"
import * as schema from "@block-feed/drizzle"
import * as testutils from "../../utils"
import { randomUUID } from "node:crypto"
import assert from "node:assert"
import Stripe from "stripe"
import z from "zod"
import {
  STRIPE_CHECKOUT_SESSION_CACHE_KEY_PREFIX,
  GraphQLContext,
  withClerkJWT,
  BaseContext,
  ApiCache,
} from "../../../src"

describe("CRUD Tests", () => {
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
  let headers = {}

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
          // In this test, none of the handlers we call will actually use the Stripe subscription
          // data that's returned from the following middleware function. The middleware function
          // is mainly used to check if the user has subscribed to our service. To keep things
          // simple and avoid making unnecessary API calls to Stripe, let's assume that if a user
          // has a valid JWT, then they also have a valid subscription. To simulate this, we'll
          // override the following middleware function with a no-op function.
          requireStripeSubscription: () => ({}) as any,
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

      // Prepares request headers
      // https://dev.to/mad/api-testing-with-clerk-and-express-2i56
      const clerkJWT = z.string().min(1).parse(process.env["CLERK_TEST_JWT"])
      headers = { Authorization: `Bearer ${clerkJWT}` }
      console.log("done!")

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
        assert.equal(result.payload.length, 0)
      })
  })
})
