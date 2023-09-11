import { AxiosError, AxiosRequestConfig } from "axios"
import { before, describe, it } from "node:test"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import { randomUUID } from "node:crypto"
import assert from "node:assert"

describe("Funcs Auth Tests", () => {
  const api = testutils.getApi()
  const db = database.createClient()

  before(async () => {
    await testutils.wipeDB(db, database.schema.blockFeed.schemaName)
  })

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

  const funcs = [
    {
      name: "find many",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.funcsFindMany(config),
    },
    {
      name: "find one",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.funcsFindOne(randomUUID(), config),
    },
    {
      name: "create",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.funcsCreate({ name: randomUUID() }, config),
    },
    {
      name: "remove",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.funcsRemove({ id: randomUUID() }, config),
    },
    {
      name: "update",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.funcsUpdate({ id: randomUUID(), name: "new-name" }, config),
    },
  ]

  it("Blocks bad requests", async () => {
    const tests = funcs.flatMap((f) => args.map((a) => ({ func: f, args: a })))
    await Promise.all(
      tests.map((t) => {
        return it(`${t.func.name} (${t.args.name})`, async () => {
          try {
            await t.func.call(t.args.headers)
          } catch (err) {
            if (!(err instanceof AxiosError)) {
              assert.fail()
            }
            assert.equal(err.response?.status, t.args.status)
            assert.equal(err.response?.data.message, t.args.error)
          }
        })
      })
    )
  })
})
