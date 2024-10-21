import { redis, rediscluster } from "@block-feed/node-providers-redis"
import { stripe } from "@block-feed/node-providers-stripe"
import { mysql } from "@block-feed/node-providers-mysql"
import { clerk } from "@block-feed/node-providers-clerk"
import { after, before, describe, it } from "node:test"
import * as testutils from "@block-feed/node-testutils"
import * as schema from "@block-feed/node-db"
import { randomUUID } from "node:crypto"
import assert from "node:assert"
import z from "zod"
import {
  GraphQLContext,
  withClerkJWT,
  BaseContext,
  zStripeEnv,
  builder,
} from "../../../src/server"
import {
  ActivateWebhooksDocument,
  RemoveWebhooksDocument,
  UpdateWebhookDocument,
  CreateWebhookDocument,
  WebhooksDocument,
  WebhookDocument,
} from "../../../src/client"

describe("CRUD Tests", () => {
  const testCleaner = new testutils.TestCleaner()
  const blockchainId = "fake-blockchain"
  const shardCount = 4
  const cacheExpMs = 30000
  const fakeStripeApiKey = "fake api key"
  const fakeStripeEnv: z.infer<typeof zStripeEnv> = {
    STRIPE_WEBHOOK_SECRET: "dummy-webhook-secret",
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

  let redisClusterC: Awaited<
    ReturnType<typeof testutils.containers.rediscluster.spawn>
  >
  let databaseC: testutils.containers.StartedTestContainer
  let redisC: testutils.containers.StartedTestContainer
  let appServer: testutils.TestServer<GraphQLContext, {}>
  let ctx: BaseContext
  let headers = {}

  before(async () => {
    try {
      // Creates containers
      process.stdout.write("Starting containers... ")
      ;[redisC, databaseC, redisClusterC] = await Promise.all([
        testutils.containers.redis.spawn(verbose.container),
        testutils.containers.db.spawn(verbose.container),
        testutils.containers.rediscluster.spawn(),
      ])
      console.log("done!")

      // Schedule the containers for cleanup
      testCleaner.add(
        () => redisC.stop(),
        () => databaseC.stop(),
        () => redisClusterC.compose.down({ removeVolumes: true }),
      )

      // Assigns urls
      const adminDbUrl = testutils.containers.db.getRootUserUrl(databaseC)
      const apiDbUrl = testutils.containers.db.getApiUserUrl(databaseC)
      const redisUrl = testutils.containers.redis.getRedisUrl(redisC)

      // Creates a stripe API client
      const stripeProvider = new stripe.Provider({
        STRIPE_API_KEY: fakeStripeApiKey,
      })

      // Creates a redis cache client
      const redisCacheProvider = new redis.Provider({
        REDIS_URL: redisUrl,
      })

      // Creates a clerk provider
      const clerkProvider = new clerk.Provider(clerk.zEnv.parse(process.env))

      // Creates a database provider
      const mysqlProvider = new mysql.Provider({
        DB_LOGGING: verbose.database,
        DB_URL: apiDbUrl,
      })

      // Creates the API context
      ctx = {
        providers: {
          stripe: stripeProvider,
          clerk: clerkProvider,
          mysql: mysqlProvider,
        },
        caches: {
          redisClusterConn: rediscluster.Provider.createRedisClusterConnCache(),
          clerkUser: clerk.Provider.createClerkUsersCache(
            clerkProvider,
            redisCacheProvider,
            cacheExpMs,
          ),
          stripeCheckoutSess: stripe.Provider.createCheckoutSessionCache(
            stripeProvider,
            redisCacheProvider,
            cacheExpMs,
          ),
        },
        middlewares: {
          // In this test, none of the handlers we call will actually use the Stripe subscription
          // data that's returned from the following middleware function. The middleware function
          // is mainly used to check if the user has subscribed to our service. To keep things
          // simple and avoid making unnecessary API calls to Stripe, let's assume that if a user
          // has a valid JWT, then they also have a valid subscription. To simulate this, we'll
          // override the following middleware function such that it never throws.
          requireStripeSubscription: () => ({}) as any,
        },
        env: {
          stripe: fakeStripeEnv,
        },
      }

      // Schedule the context for cleanup
      testCleaner.add(
        () => redisCacheProvider.client.quit(),
        () =>
          new Promise((res, rej) => {
            mysqlProvider.pool.end((err) => {
              if (err != null) {
                rej(err)
              }
              res(null)
            })
          }),
      )

      // Prepares request headers
      // https://dev.to/mad/api-testing-with-clerk-and-express-2i56
      const clerkJWT = z.string().min(1).parse(process.env["CLERK_TEST_JWT"])
      headers = { Authorization: `bearer ${clerkJWT}` }

      // Seeds the database with some fake data
      await testutils.withMySqlDatabaseConn(adminDbUrl, async ({ conn }) => {
        await conn.transaction(async (tx) => {
          await tx.insert(schema.blockchain).values({
            id: blockchainId,
            redisClusterUrl: redisClusterC.url,
            shardCount,
            redisStreamUrl: "not used by the API",
            redisStoreUrl: "not used by the API",
            pgStoreUrl: "not used by the API",
            url: "not used by the API",
          })
        })
      })

      // Creates a mock API server from the context
      appServer = await testutils.TestServer.build({
        schema: builder.toSchema(),
        context: async (context) => {
          return {
            ...ctx,
            yoga: {
              waitUntil: () => new Promise((res) => res(undefined)),
              request: context.request,
              params: context.params,
            },
          } satisfies GraphQLContext
        },
        plugins: [
          withClerkJWT({
            clerk: ctx.providers.clerk,
            db: ctx.providers.mysql,
            cache: clerk.Provider.createClerkUsersCache(
              clerkProvider,
              redisCacheProvider,
            ),
          }),
        ],
      })

      // Schedule the server for cleanup
      testCleaner.add(() => appServer.close())
    } catch (err) {
      // The node test runner won't log any errors that occur in
      // the before hook, so we need to log them manually
      console.error(err)
      throw err
    }
  })

  after(async () => {
    await testCleaner.cleanUp(console.error)
  })

  it("Integration Test", async () => {
    // Defines fake data
    const data = {
      url: "http://fakeurl.com",
      maxRetries: 10,
      maxBlocks: 10,
      timeoutMs: 1000,
    }

    // Creates an item in the database
    const id = await appServer
      .makeRequest(
        CreateWebhookDocument,
        {
          data: {
            ...data,
            blockchainId: blockchainId,
          },
        },
        headers,
      )
      .then((result) => {
        const { data, errors } = result.payload
        if (errors != null) {
          assert.fail(new Error(JSON.stringify(errors, null, 2)))
        }
        if (data == null) {
          assert.fail(JSON.stringify(result, null, 2))
        }
        return data.webhookCreate.id
      })

    // Updates the item
    const newMaxBlocks = 1
    await appServer
      .makeRequest(
        UpdateWebhookDocument,
        {
          id,
          data: {
            ...data,
            maxBlocks: newMaxBlocks,
          },
        },
        headers,
      )
      .then((result) => {
        const { data, errors } = result.payload
        if (errors != null) {
          assert.fail(new Error(JSON.stringify(errors, null, 2)))
        }
        if (data == null) {
          assert.fail(JSON.stringify(result, null, 2))
        }
        assert.notEqual(data.webhookUpdate.count, 0)
      })

    // The created item should exist and be updated
    await appServer
      .makeRequest(WebhookDocument, { id }, headers)
      .then((result) => {
        const { data, errors } = result.payload
        if (errors != null) {
          assert.fail(new Error(JSON.stringify(errors, null, 2)))
        }
        if (data == null) {
          assert.fail(JSON.stringify(result, null, 2))
        }
        assert.equal(data.webhook.id, id)
        assert.equal(data.webhook.isActive, 0)
        assert.equal(data.webhook.maxBlocks, newMaxBlocks)
      })

    // Activate with an empty list should trivially return 0
    await appServer
      .makeRequest(ActivateWebhooksDocument, { ids: [] }, headers)
      .then((result) => {
        const { data, errors } = result.payload
        if (errors != null) {
          assert.fail(new Error(JSON.stringify(errors, null, 2)))
        }
        if (data == null) {
          assert.fail(JSON.stringify(result, null, 2))
        }
        assert.equal(data.webhookActivate.count, 0)
      })

    // Activating a nonexistent webhook should trivially return 0
    await appServer
      .makeRequest(ActivateWebhooksDocument, { ids: [randomUUID()] }, headers)
      .then((result) => {
        const { data, errors } = result.payload
        if (errors != null) {
          assert.fail(new Error(JSON.stringify(errors, null, 2)))
        }
        if (data == null) {
          assert.fail(JSON.stringify(result, null, 2))
        }
        assert.equal(data.webhookActivate.count, 0)
      })

    // Activates the webhook
    await appServer
      .makeRequest(ActivateWebhooksDocument, { ids: [id] }, headers)
      .then((result) => {
        const { data, errors } = result.payload
        if (errors != null) {
          assert.fail(new Error(JSON.stringify(errors, null, 2)))
        }
        if (data == null) {
          assert.fail(JSON.stringify(result, null, 2))
        }
        assert.equal(data.webhookActivate.count, 1)
      })

    // Remove with an empty list should trivially return 0
    await appServer
      .makeRequest(RemoveWebhooksDocument, { ids: [] }, headers)
      .then((result) => {
        const { data, errors } = result.payload
        if (errors != null) {
          assert.fail(new Error(JSON.stringify(errors, null, 2)))
        }
        if (data == null) {
          assert.fail(JSON.stringify(result, null, 2))
        }
        assert.equal(data.webhookRemove.count, 0)
      })

    // Removing a nonexistent webhook should trivially return 0
    await appServer
      .makeRequest(RemoveWebhooksDocument, { ids: [randomUUID()] }, headers)
      .then((result) => {
        const { data, errors } = result.payload
        if (errors != null) {
          assert.fail(new Error(JSON.stringify(errors, null, 2)))
        }
        if (data == null) {
          assert.fail(JSON.stringify(result, null, 2))
        }
        assert.equal(data.webhookRemove.count, 0)
      })

    // Removes the webhook
    await appServer
      .makeRequest(RemoveWebhooksDocument, { ids: [id] }, headers)
      .then((result) => {
        const { data, errors } = result.payload
        if (errors != null) {
          assert.fail(new Error(JSON.stringify(errors, null, 2)))
        }
        if (data == null) {
          assert.fail(JSON.stringify(result, null, 2))
        }
        assert.equal(data.webhookRemove.count, 1)
      })

    // No results should be returned
    await appServer
      .makeRequest(
        WebhooksDocument,
        {
          pagination: { limit: 10, cursor: null },
          filters: {},
        },
        headers,
      )
      .then((result) => {
        const { data, errors } = result.payload
        if (errors != null) {
          assert.fail(new Error(JSON.stringify(errors, null, 2)))
        }
        if (data == null) {
          assert.fail(JSON.stringify(result, null, 2))
        }
        assert.equal(data.webhooks.payload.length, 0)
      })
  })
})
