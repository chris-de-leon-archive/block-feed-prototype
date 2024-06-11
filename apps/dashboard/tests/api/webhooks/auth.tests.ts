import { RedisCacheFactory, LruCacheFactory } from "@block-feed/node-caching"
import { stripe } from "@block-feed/node-providers-stripe"
import { redis } from "@block-feed/node-providers-redis"
import { mysql } from "@block-feed/node-providers-mysql"
import { clerk } from "@block-feed/node-providers-clerk"
import { after, before, describe, it } from "node:test"
import * as testutils from "@block-feed/node-testutils"
import { randomInt, randomUUID } from "node:crypto"
import * as schema from "@block-feed/node-db"
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

describe("Auth Tests", () => {
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

  const getFunctionsToTest = () => [
    {
      name: "create",
      call: async (headers: HeadersInit | undefined) =>
        await appServer.makeRequest(
          CreateWebhookDocument,
          {
            data: {
              url: "http://fakeurl.com",
              maxRetries: 10,
              maxBlocks: 10,
              timeoutMs: 1000,
              blockchainId: blockchainId,
            },
          },
          headers,
        ),
    },
    {
      name: "activate",
      call: async (headers: HeadersInit | undefined) =>
        await appServer.makeRequest(
          ActivateWebhooksDocument,
          {
            ids: [randomUUID()],
          },
          headers,
        ),
    },
    {
      name: "find many",
      call: async (headers: HeadersInit | undefined) =>
        await appServer.makeRequest(
          WebhooksDocument,
          {
            filters: {},
            pagination: {
              limit: 10,
            },
          },
          headers,
        ),
    },
    {
      name: "find one",
      call: async (headers: HeadersInit | undefined) =>
        await appServer.makeRequest(
          WebhookDocument,
          { id: randomUUID() },
          headers,
        ),
    },
    {
      name: "update",
      call: async (headers: HeadersInit | undefined) =>
        await appServer.makeRequest(
          UpdateWebhookDocument,
          {
            id: randomUUID(),
            data: {
              url: "http://does-not-matter.com",
              maxBlocks: randomInt(1, 10),
              maxRetries: randomInt(0, 10),
              timeoutMs: randomInt(1000, 5000),
            },
          },
          headers,
        ),
    },
    {
      name: "remove",
      call: async (headers: HeadersInit | undefined) =>
        await appServer.makeRequest(
          RemoveWebhooksDocument,
          { ids: [randomUUID()] },
          headers,
        ),
    },
  ]

  const args = [
    {
      name: "bad token",
      error: "could not verify token",
      status: 401,
      headers: { Authorization: "bearer none" },
    },
    {
      name: "malformed header",
      error: "authorization header is malformed",
      status: 401,
      headers: { Authorization: "  bearer       lots  of   spaces    " },
    },
    {
      name: "no bearer",
      error: "authorization header is malformed",
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

      // Assigns container urls
      const adminDbUrl = testutils.containers.db.getRootUserUrl(databaseC)
      const apiDbUrl = testutils.containers.db.getApiUserUrl(databaseC)
      const redisUrl = testutils.containers.redis.getRedisUrl(redisC)

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
          redisClusterConn: LruCacheFactory.createRedisClusterConnCache(),
          clerkUser: RedisCacheFactory.createClerkUsersCache(
            clerkProvider,
            redisCacheProvider,
            cacheExpMs,
          ),
          stripeCheckoutSess: RedisCacheFactory.createCheckoutSessionCache(
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

      // Creates a mock API server from the context
      appServer = await testutils.TestServer.build({
        schema: builder.toSchema(),
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
            clerk: ctx.providers.clerk,
            db: ctx.providers.mysql,
            cache: RedisCacheFactory.createClerkUsersCache(
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
    await Promise.allSettled(
      getFunctionsToTest()
        .flatMap((f) => args.map((a) => ({ func: f, args: a })))
        .map(async (test) => {
          return await it(`${test.func.name} (${test.args.name})`, async () => {
            const result = await test.func.call(test.args.headers)
            const errmsg = JSON.stringify(result, null, 2)
            const errs = result.payload.errors
            if (errs == null) {
              assert.fail(errmsg)
            } else {
              assert.equal(errs.at(0)?.message, test.args.error, errmsg)
              assert.equal(result.status, test.args.status, errmsg)
            }
          })
        }),
    )
  })
})
