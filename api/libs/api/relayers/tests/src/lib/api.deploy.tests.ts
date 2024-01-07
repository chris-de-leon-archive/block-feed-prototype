import { createWebhookServer, createAppServer } from "./utils"
import { after, before, describe, it } from "node:test"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import { auth0 } from "@api/shared/auth0"
import { randomUUID } from "node:crypto"
import { k8s } from "@api/shared/k8s"
import { api } from "@api/api/core"
import assert from "node:assert"

// TODO: make sure docker images are pushed to dockerhub
describe("Relayers Deploy Tests", () => {
  let auth0User: Awaited<ReturnType<typeof testutils.createAuth0User>>
  let headers = {}
  let counter = 0

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

  const deployment = {
    name: "test-deployment", // TODO: add validation for naming to API
    namespace: "default", // how can we use other namespaces?
  }

  const appServer = testutils.asyncServer(
    createAppServer(ctx, {
      verbose: true,
    }),
  )

  const whServer = testutils.asyncServer(
    createWebhookServer({
      onReq: (req) => {
        counter += 1
        let body = ""
        req
          .on("data", (chunk) => {
            body += chunk
          })
          .on("end", () => {
            // TODO: test that block heights are increasing
            const data = JSON.parse(body)
            console.log(`Received block ${data.height}`)
          })
      },
    }),
  )

  before(async () => {
    // Sets up an Auth0 user
    const user = await testutils.createAuth0User(ctx.auth0)
    const grnt = await user.getGrant()

    // Cleans redis
    await testutils.wipeRedis()

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

    // Sets up the API and webhook servers
    await appServer.start()
    await whServer.start()

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
        ctx.k8s.client.deleteNamespacedDeployment(
          deployment.name,
          deployment.namespace,
        ),
        appServer.close(),
        whServer.close(),
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

    // Defines the relayers
    // TODO: all relayers use the same redis DB and may interact with the same keys, so transaction errors may occur if more than 1 relayer is created
    const relayers = Array.from({ length: 1 }).map(() => {
      return {
        name: randomUUID(),
        deploymentId,
        chain: database.schema.Blockchains.FLOW,
        transport: database.schema.RelayerTransports.HTTP,
        options: {
          RELAYER_NETWORK_URL: "access.devnet.nodes.onflow.org:9000",
          RELAYER_POLL_MS: 3000,
          RELAYER_HTTP_RETRY_DELAY_MS: 3000,
          RELAYER_HTTP_MAX_RETRIES: 3,
          RELAYER_HTTP_URL: `http://host.docker.internal:${
            whServer.getInfo().port
          }/webhook`,
        },
      }
    })

    // Creates the relayers
    const relayerIds = new Array<string>()
    for (const r of relayers) {
      await sdk
        .relayersCreate(r, { headers })
        .then((result) => {
          const id = result.data.id
          if (id == null) {
            assert.fail("create failed")
          }
          relayerIds.push(id)
        })
        .catch(testutils.handleAxiosError)
    }

    // Ensures that the webhook server has not received anything yet
    assert.equal(counter, 0)

    // Deploys the relayers
    await sdk
      .relayersDeploy({ deploymentId }, { headers })
      .catch(testutils.handleAxiosError)

    // Waits for the cluster to pull the image and send some data to the webhook server
    console.log()
    await new Promise((res) => setTimeout(res, 10000))

    // Confirms that the webhook server got some data
    assert.ok(counter > 0, "webhook server was not called")
    console.log()
    console.log("Status Report:")
    console.log(
      JSON.stringify(
        {
          "Calls Received": counter,
        },
        null,
        2,
      ),
    )
    console.log()

    // Redeploying should NOT cause an error
    await sdk
      .relayersDeploy({ deploymentId }, { headers })
      .catch(testutils.handleAxiosError)
  })
})
