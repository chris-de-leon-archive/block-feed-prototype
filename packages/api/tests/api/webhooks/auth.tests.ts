import { stripe, redis, auth0, db, StripeVendor } from "@block-feed/vendors"
import { ClientError, RequestOptions } from "graphql-request"
import { after, before, describe, it } from "node:test"
import { randomInt, randomUUID } from "node:crypto"
import * as testcontainers from "testcontainers"
import * as schema from "@block-feed/drizzle"
import * as testutils from "../../utils"
import { UserInfoResponse } from "auth0"
import assert from "node:assert"
import Stripe from "stripe"
import {
  STRIPE_CHECKOUT_SESSION_CACHE_KEY_PREFIX,
  AUTH0_PROFILE_CACHE_KEY_PREFIX,
  requireStripeSubscription,
  GraphQLContext,
  withAuth0JWT,
  BaseContext,
  ApiCache,
} from "../../../src"

describe("Auth Tests", () => {
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
      error: "invalid access token",
      status: 401,
      headers: { Authorization: "bearer none" },
    },
    {
      name: "no bearer",
      error: 'authorization header value is missing "bearer" prefix',
      status: 400,
      headers: { Authorization: "basic none" },
    },
    {
      name: "no authorization header",
      error: "request is missing authorization header",
      status: 400,
      headers: undefined,
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
    adminDbUrl = testutils.containers.db.getRootUserUrl(databaseC)
    apiDbUrl = testutils.containers.db.getFrontendUserUrl(databaseC)
    redisUrl = testutils.containers.redis.getRedisUrl(redisC)

    // Seeds the database with some fake data
    await testutils.containers.db.withDatabaseConn(
      adminDbUrl,
      async ({ conn }) => {
        await conn.transaction(async (tx) => {
          // There's no need to add the auth0 user to the database
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
        auth0: auth0.client.create(auth0.client.zEnv.parse(process.env)),
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
        auth0: new ApiCache<UserInfoResponse>(
          redisCache,
          cacheExpMs,
          AUTH0_PROFILE_CACHE_KEY_PREFIX,
        ),
      },
      middlewares: {
        requireStripeSubscription,
      },
      env: {
        CACHE_EXP_SEC: cacheExpMs,
      },
    }

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
        withAuth0JWT({
          auth0: ctx.vendor.auth0,
          cache: ctx.caches.auth0,
          db: ctx.vendor.db,
        }),
      ],
    })
  })

  after(async () => {
    await testutils.runPromisesInOrder(
      [
        appServer.close(),
        new Promise((res, rej) => {
          ctx.vendor.db.pool.end((err) => {
            if (err != null) {
              rej(err)
            }
            res(null)
          })
        }),
        ctx.vendor.redisWebhookLB.client.quit(),
        redisCache.client.quit(),
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
