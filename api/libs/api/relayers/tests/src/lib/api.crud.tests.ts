import { after, before, describe, it } from "node:test"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import { auth0 } from "@api/shared/auth0"
import { randomUUID } from "node:crypto"
import assert from "node:assert"

describe("Relayers CRUD", () => {
  const deploymentId = randomUUID()
  const a0 = auth0.createClient()
  const api = testutils.getApi()
  const db = database.core.createClient({
    DB_URL: testutils.getEnvVars().TEST_DB_URL,
    DB_LOGGING: true,
  })

  let headers = {}
  let auth0User: Awaited<ReturnType<typeof testutils.createAuth0User>> | null =
    null

  before(async () => {
    const user = await testutils.createAuth0User(a0)
    const grnt = await user.getGrant()

    await testutils.wipeDB(db.drizzle)
    await db.drizzle
      .transaction(async (tx) => {
        const userInfo = user.getInfo()
        await tx.insert(database.schema.users).values({
          id: userInfo.user_id,
        })
        await tx.insert(database.schema.deployments).values({
          id: deploymentId,
          name: "test",
          namespace: "test",
          userId: userInfo.user_id,
        })
      })
      .catch((err) => {
        console.error(err)
        throw err
      })

    auth0User = user
    headers = {
      Authorization: `bearer ${grnt.access_token}`,
    }
  })

  after(async () => {
    await auth0User?.cleanUp()
    await new Promise((res, rej) => {
      db.pool.end((err) => {
        if (err != null) {
          rej(err)
          return
        }
        res(undefined)
      })
    })
  })

  it("Integration Test", async () => {
    // Creates a relayer
    const id = await api
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
    await api
      .relayersUpdate({ id, name: undefined }, { headers })
      .then((result) => {
        assert.equal(result.data.count, 0)
      })
      .catch(testutils.handleAxiosError)

    // Updates the relayer
    const newName = "new-name"
    await api
      .relayersUpdate({ id, name: newName }, { headers })
      .then((result) => {
        assert.equal(result.data.count, 1)
      })
      .catch(testutils.handleAxiosError)

    // Makes sure the relayer was updated
    await api
      .relayersFindOne(id, { headers })
      .then((result) => {
        assert.equal(result.data.id, id)
        assert.equal(result.data.name, newName)
      })
      .catch(testutils.handleAxiosError)

    // Removes the relayer
    await api
      .relayersRemove({ id }, { headers })
      .then((result) => {
        assert.equal(result.data.count, 1)
      })
      .catch(testutils.handleAxiosError)

    // Find many should return no results
    await api
      .relayersFindMany(undefined, undefined, { headers })
      .then((result) => {
        assert.equal(result.data.length, 0)
      })
      .catch(testutils.handleAxiosError)
  })
})
