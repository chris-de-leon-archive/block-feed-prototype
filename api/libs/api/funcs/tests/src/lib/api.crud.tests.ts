import { FlowBlockchain } from "@api/block-gateway/core/blockchains/flow"
import { after, before, describe, it } from "node:test"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import { auth0 } from "@api/shared/auth0"
import { randomUUID } from "node:crypto"
import { flow } from "@api/shared/flow"
import assert from "node:assert"

describe("Funcs CRUD Test", () => {
  const dbAdmin = database.core.createClient(database.core.getEnvVars().DB_URL)
  const blockchain = new FlowBlockchain(flow.createClient())
  const chainInfo = blockchain.getInfo()
  const a0 = auth0.createClient()
  const api = testutils.getApi()

  let headers = {}
  let auth0User: Awaited<ReturnType<typeof testutils.createAuth0User>> | null =
    null

  before(async () => {
    await testutils.wipeDB(dbAdmin, database.schema.blockFeed.schemaName)

    const user = await testutils.createAuth0User(a0)
    const grnt = await user.getGrant()

    await database.queries.blockCursor.create(dbAdmin, {
      blockchain: chainInfo.name,
      id: chainInfo.id,
      networkURL: chainInfo.networkURL,
    })

    auth0User = user
    headers = {
      Authorization: `bearer ${grnt.access_token}`,
    }
  })

  after(async () => {
    await auth0User?.cleanUp()
  })

  it("creates a function", async () => {
    await api
      .funcsCreate(
        {
          name: randomUUID(),
          cursorId: chainInfo.id,
        },
        { headers }
      )
      .then((result) => {
        assert.equal(result.data.count, 1)
      })
      .catch(testutils.handleAxiosError)

    await it("finds many functions", async () => {
      const firstId = await api
        .funcsFindMany(undefined, undefined, { headers })
        .then((result) => {
          const id = result.data.at(0)?.id
          if (id == null) {
            assert.fail("Received null or undefined ID")
          }
          return id
        })
        .catch(testutils.handleAxiosError)

      await it("updates a function", async () => {
        const newName = "new-name"
        await api
          .funcsUpdate(
            {
              id: firstId,
              name: newName,
            },
            {
              headers,
            }
          )
          .then((result) => {
            assert.equal(result.data.count, 1)
          })
          .catch(testutils.handleAxiosError)

        await it("finds a function by ID", async () => {
          await api
            .funcsFindOne(firstId, { headers })
            .then((result) => {
              assert.equal(result.data.name, newName)
            })
            .catch(testutils.handleAxiosError)
        })

        await it("removes a function", async () => {
          await api
            .funcsRemove({ id: firstId }, { headers })
            .then((result) => {
              assert.equal(result.data.count, 1)
            })
            .catch(testutils.handleAxiosError)
        })
      })
    })
  })
})
