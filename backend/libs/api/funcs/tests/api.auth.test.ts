import { testutils } from "../../../shared/testing"
import { database } from "../../../shared/database"
import { before, describe, it } from "node:test"
import { randomUUID } from "node:crypto"
import { AxiosError } from "axios"
import assert from "node:assert"

describe.skip("Funcs Auth Tests", () => {
  const db = database.createClient()
  const api = testutils.getApi()

  before(async () => {
    await testutils.wipeDB(db, database.schema.blockFeed.schemaName)
  })

  const tests = [
    {
      name: "create",
      noAuthHeader: async () =>
        await api.funcsCreate({ name: randomUUID() }, { headers: {} }),
      noBearer: async () =>
        await api.funcsCreate(
          { name: randomUUID() },
          { headers: { Authorization: "basic none" } }
        ),
      badToken: async () =>
        await api.funcsCreate(
          { name: randomUUID() },
          { headers: { Authorization: "bearer none" } }
        ),
    },
    {
      name: "remove",
      noAuthHeader: async () =>
        await api.funcsRemove({ id: randomUUID() }, { headers: {} }),
      noBearer: async () =>
        await api.funcsRemove(
          { id: randomUUID() },
          { headers: { Authorization: "basic none" } }
        ),
      badToken: async () =>
        await api.funcsRemove(
          { id: randomUUID() },
          { headers: { Authorization: "bearer none" } }
        ),
    },
    {
      name: "find one",
      noAuthHeader: async () =>
        await api.funcsFindOne(randomUUID(), { headers: {} }),
      noBearer: async () =>
        await api.funcsFindOne(randomUUID(), {
          headers: { Authorization: "basic none" },
        }),
      badToken: async () =>
        await api.funcsFindOne(randomUUID(), {
          headers: { Authorization: "bearer none" },
        }),
    },
    {
      name: "find many",
      noAuthHeader: async () => await api.funcsFindMany({ headers: {} }),
      noBearer: async () =>
        await api.funcsFindMany({ headers: { Authorization: "basic none" } }),
      badToken: async () =>
        await api.funcsFindMany({
          headers: { Authorization: "bearer none" },
        }),
    },
    {
      name: "update",
      noAuthHeader: async () =>
        await api.funcsUpdate(
          { id: randomUUID(), name: "new-name" },
          { headers: {} }
        ),
      noBearer: async () =>
        await api.funcsUpdate(
          { id: randomUUID(), name: "new-name" },
          { headers: { Authorization: "basic none" } }
        ),
      badToken: async () =>
        await api.funcsUpdate(
          { id: randomUUID(), name: "new-name" },
          { headers: { Authorization: "bearer none" } }
        ),
    },
  ]

  it("blocks requests that don't have an authorization header", async () => {
    await Promise.all(
      tests.map((t) => {
        return it(t.name, async () => {
          try {
            await t.noAuthHeader()
          } catch (err) {
            if (!(err instanceof AxiosError)) {
              assert.fail()
            }
            assert.equal(err.response?.status, 400)
            assert.equal(
              err.response?.data.message,
              "request is missing authorization header"
            )
          }
        })
      })
    )
  })

  it("blocks requests that don't use bearer auth", async () => {
    await Promise.all(
      tests.map((t) => {
        return it(t.name, async () => {
          try {
            await t.noBearer()
          } catch (err) {
            if (!(err instanceof AxiosError)) {
              assert.fail()
            }
            assert.equal(err.response?.status, 400)
            assert.equal(
              err.response?.data.message,
              'authorization header value is missing "bearer" prefix'
            )
          }
        })
      })
    )
  })

  it("blocks requests that don't have a valid access token", async () => {
    await Promise.all(
      tests.map((t) => {
        return it(t.name, async () => {
          try {
            await t.badToken()
          } catch (err) {
            if (!(err instanceof AxiosError)) {
              assert.fail()
            }
            assert.equal(err.response?.status, 401)
            assert.equal(err.response?.data.message, "invalid access token")
          }
        })
      })
    )
  })
})
