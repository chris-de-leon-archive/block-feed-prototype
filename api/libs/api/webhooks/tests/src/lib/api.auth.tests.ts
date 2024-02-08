import { after, before, describe, it } from "node:test"
import { AxiosRequestConfig, AxiosError } from "axios"
import { WebhooksAPI } from "@api/api/webhooks/api"
import * as testcontainers from "testcontainers"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import { auth0 } from "@api/shared/auth0"
import { randomUUID } from "node:crypto"
import { trpc } from "@api/shared/trpc"
import assert from "node:assert"
import {
  getAdminRoleUrl,
  getApiRoleUrl,
} from "libs/shared/testing/src/lib/core"

const t = trpc.createTRPC<WebhooksAPI.Context>()

const router = t.router({
  [WebhooksAPI.NAMESPACE]: t.router({
    [WebhooksAPI.OPERATIONS.FIND_MANY.NAME]: WebhooksAPI.findMany(t),
    [WebhooksAPI.OPERATIONS.FIND_ONE.NAME]: WebhooksAPI.findOne(t),
    [WebhooksAPI.OPERATIONS.CREATE.NAME]: WebhooksAPI.create(t),
    [WebhooksAPI.OPERATIONS.REMOVE.NAME]: WebhooksAPI.remove(t),
  }),
})

describe("Auth Tests", () => {
  const verboseDatabaseLogging = true
  const blockchainId = "fake-blockchain"

  let appServer: Awaited<ReturnType<typeof testutils.createAsyncServer>>
  let databaseC: testcontainers.StartedTestContainer
  let ctx: WebhooksAPI.Context
  let adminDbUrl: string
  let apiDbUrl: string

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
    // Creates a database container
    process.stdout.write("Starting postgres container... ")
    databaseC = await testutils.spawnDB()
    console.log("done!")

    // Assigns database urls
    adminDbUrl = getAdminRoleUrl(databaseC)
    apiDbUrl = getApiRoleUrl(databaseC)

    // Seeds the database with some fake data
    await testutils.withDatabaseConn(adminDbUrl, async ({ db }) => {
      await db.transaction(async (tx) => {
        // NOTE: there's no need to add the auth0 user to the database
        // The middleware will take care of that automatically
        await tx.insert(database.schema.blockchain).values({
          id: blockchainId,
          url: "http://does-not-matter.com",
        })
        await tx.insert(database.schema.blockCache).values({
          blockchainId: blockchainId,
          blockHeight: 1000,
          block: JSON.stringify([{ fake: "block data" }]),
        })
      })
    })

    // Creates a TRPC context
    ctx = {
      auth0: auth0.createClient(),
      database: database.core.createClient({
        DB_LOGGING: verboseDatabaseLogging,
        DB_URL: apiDbUrl,
      }),
    }

    // Creates a mock API server from the context
    appServer = await testutils.createAsyncServer(
      testutils.createMockApiServer(ctx, {
        router,
        onError: (opts) => {
          console.error(opts)
        },
      }),
    )
  })

  after(async () => {
    await testutils.runPromisesInOrder(
      [appServer.close(), ctx.database.pool.end(), databaseC.stop()],
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
