import { after, before, describe, it } from "node:test"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import { auth0 } from "@api/shared/auth0"
import { randomUUID } from "node:crypto"
import assert from "node:assert"

describe("Funcs CRUD Test", () => {
  const auth0Client = auth0.createClient()
  const db = database.createClient()
  const api = testutils.getApi()

  let headers = {}
  let auth0User: Awaited<
    ReturnType<(typeof testutils)["createAuth0User"]>
  > | null = null

  before(async () => {
    await testutils.wipeDB(db, database.schema.blockFeed.schemaName)

    const user = await testutils.createAuth0User(auth0Client)
    const grnt = await user.getGrant()

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
      .funcsCreate({ name: randomUUID() }, { headers })
      .then((result) => {
        assert.equal(result.data.count, 1)
      })

    await it("finds many functions", async () => {
      const firstId = await api.funcsFindMany({ headers }).then((result) => {
        assert.equal(result.data.length > 0, true)
        return result.data[0].id
      })

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

        await it("finds a function by ID", async () => {
          await api.funcsFindOne(firstId, { headers }).then((result) => {
            assert.equal(result.data.name, newName)
          })
        })

        await it("removes a function", async () => {
          await api.funcsRemove({ id: firstId }, { headers }).then((result) => {
            assert.equal(result.data.count, 1)
          })
        })
      })
    })
  })
})
