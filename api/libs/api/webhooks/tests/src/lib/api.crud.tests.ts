import { after, before, describe, it } from "node:test"
import { WebhooksAPI } from "@api/api/webhooks/api"
import * as testcontainers from "testcontainers"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import { auth0 } from "@api/shared/auth0"
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

describe("CRUD Tests", () => {
  const verboseDatabaseLogging = true
  const blockchainId = "fake-blockchain"

  let auth0User: Awaited<ReturnType<typeof testutils.createAuth0User>>
  let appServer: Awaited<ReturnType<typeof testutils.createAsyncServer>>
  let databaseC: testcontainers.StartedTestContainer
  let ctx: WebhooksAPI.Context
  let adminDbUrl: string
  let apiDbUrl: string
  let headers = {}

  before(async () => {
    // Creates a database container
    process.stdout.write("Starting postgres container... ")
    databaseC = await testutils.spawnDB()
    console.log("done!")

    // Assigns database urls
    adminDbUrl = getAdminRoleUrl(databaseC)
    apiDbUrl = getApiRoleUrl(databaseC)

    // Creates a TRPC context
    ctx = {
      auth0: auth0.createClient(),
      database: database.core.createClient({
        DB_LOGGING: verboseDatabaseLogging,
        DB_URL: apiDbUrl,
      }),
    }

    // Creates an Auth0 user
    process.stdout.write("Creating Auth0 user... ")
    auth0User = await testutils.createAuth0User(ctx.auth0)
    headers = {
      Authorization: `bearer ${auth0User.accessToken}`,
    }
    console.log("done!")

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
      [
        appServer.close(),
        ctx.database.pool.end(),
        databaseC.stop(),
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

    // Creates an item in the database
    const id = await sdk
      .webhooksCreate(
        {
          url: "http://fakeurl.com",
          maxRetries: 10,
          maxBlocks: 10,
          timeoutMs: 1000,
          blockchainId: blockchainId,
        },
        { headers },
      )
      .then((result) => {
        const id = result.data.id
        if (id == null) {
          assert.fail("create failed")
        }
        return id
      })
      .catch(testutils.handleAxiosError)

    // The created item should exist
    await sdk
      .webhooksFindOne(id, { headers })
      .then((result) => {
        assert.equal(result.data.id, id)
      })
      .catch(testutils.handleAxiosError)

    // A webhook job should also be created with the webhook
    await testutils
      .withDatabaseConn(adminDbUrl, async ({ db }) => {
        return await db.query.webhookJob.findFirst({
          where(fields, operators) {
            return operators.eq(fields.webhookId, id)
          },
        })
      })
      .then((webhookJob) => {
        if (webhookJob == null) {
          assert.fail("corresponding webhook job was not created")
        }
      })

    // The webhhok should be removed
    await sdk
      .webhooksRemove({ id }, { headers })
      .then((result) => {
        assert.equal(result.data.count, 1)
      })
      .catch(testutils.handleAxiosError)

    // The webhook job should also be removed
    await testutils
      .withDatabaseConn(adminDbUrl, async ({ db }) => {
        return await db.query.webhookJob.findFirst({
          where(fields, operators) {
            return operators.eq(fields.webhookId, id)
          },
        })
      })
      .then((webhookJob) => {
        if (webhookJob != null) {
          assert.fail("corresponding webhook job was not removed")
        }
      })

    // No results should be returned
    await sdk
      .webhooksFindMany(undefined, undefined, { headers })
      .then((result) => {
        assert.equal(result.data.length, 0)
      })
      .catch(testutils.handleAxiosError)
  })
})
