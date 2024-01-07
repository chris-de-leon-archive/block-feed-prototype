import { after, before, describe, it } from "node:test"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import { createAppServer } from "./utils"
import { auth0 } from "@api/shared/auth0"
import { randomUUID } from "node:crypto"
import { k8s } from "@api/shared/k8s"
import { api } from "@api/api/core"
import assert from "node:assert"

describe("Relayers CRUD Tests", () => {
  let auth0User: Awaited<ReturnType<typeof testutils.createAuth0User>>
  let headers = {}

  const env = { test: testutils.getEnvVars(), api: api.core.getEnvVars() }
  const ctx = {
    auth0: auth0.createClient(),
    k8s: k8s.createClient(),
    env: { api: env.api },
    database: database.core.createClient({
      DB_URL: env.test.TEST_DB_URL,
      DB_LOGGING: env.test.TEST_DB_LOGGING,
    }),
  }

  const appServer = testutils.asyncServer(
    createAppServer(ctx, { verbose: true }),
  )

  const deployment = {
    name: "test-deployment", // TODO: add validation for naming to API
    namespace: "default",
  }

  before(async () => {
    // Sets up an Auth0 user
    const user = await testutils.createAuth0User(ctx.auth0)
    const grnt = await user.getGrant()

    // Sets up the database
    await testutils.wipeDB(ctx.database.drizzle)
    await ctx.database.drizzle
      .transaction(async (tx) => {
        await tx.insert(database.schema.users).values({
          id: user.getInfo().user_id,
        })
      })
      .catch((err) => {
        console.error(err)
        throw err
      })

    // Sets up the API server
    await appServer.start()

    // Sets up helper variables
    auth0User = user
    headers = {
      Authorization: `bearer ${grnt.access_token}`,
    }
  })

  after(async () => {
    await testutils.runPromisesInOrder(
      [
        auth0User?.cleanUp(),
        appServer.close(),
        new Promise((res, rej) => {
          ctx.database.pool.end((err) => {
            if (err != null) {
              rej(err)
              return
            }
            res(undefined)
          })
        }),
      ],
      (err) => {
        console.error(err)
      },
    )
  })

  it("Integration Test", async () => {
    // Gets the OpenAPI SDK
    const sdk = testutils.getApi({
      basePath: appServer.getInfo().url,
    })

    // Gets user info
    const userInfo = auth0User.getInfo()

    // TODO: creates a deployment
    const deploymentId = await database.queries.deployments
      .create(ctx.database, {
        data: {
          ...deployment,
          userId: userInfo.user_id,
        },
      })
      .then((result) => {
        if (result.id == null) {
          assert.fail("deployment was not created")
        }
        return result.id
      })

    // Creates a relayer
    const id = await sdk
      .relayersCreate(
        {
          name: randomUUID(),
          deploymentId,
          chain: database.schema.Blockchains.FLOW,
          transport: database.schema.RelayerTransports.HTTP,
          options: {
            RELAYER_NETWORK_URL: "access.devnet.nodes.onflow.org:9000",
            RELAYER_POLL_MS: 3000,
            RELAYER_HTTP_RETRY_DELAY_MS: 3000,
            RELAYER_HTTP_MAX_RETRIES: 3,
            RELAYER_HTTP_URL: "http://localhost:3000",
          },
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

    // Makes sure void updates don't cause any errors
    await sdk
      .relayersUpdate({ id, name: undefined }, { headers })
      .then((result) => {
        assert.equal(result.data.count, 0)
      })
      .catch(testutils.handleAxiosError)

    // Updates the relayer
    const newName = "new-name"
    await sdk
      .relayersUpdate({ id, name: newName }, { headers })
      .then((result) => {
        assert.equal(result.data.count, 1)
      })
      .catch(testutils.handleAxiosError)

    // Makes sure the relayer was updated
    await sdk
      .relayersFindOne(id, { headers })
      .then((result) => {
        assert.equal(result.data.id, id)
        assert.equal(result.data.name, newName)
      })
      .catch(testutils.handleAxiosError)

    // Removes the relayer
    await sdk
      .relayersRemove({ id }, { headers })
      .then((result) => {
        assert.equal(result.data.count, 1)
      })
      .catch(testutils.handleAxiosError)

    // Find many should return no results
    await sdk
      .relayersFindMany(undefined, undefined, { headers })
      .then((result) => {
        assert.equal(result.data.length, 0)
      })
      .catch(testutils.handleAxiosError)
  })
})
