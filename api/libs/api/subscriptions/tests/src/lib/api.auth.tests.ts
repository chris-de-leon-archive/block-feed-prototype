import { subscriptionsAPI } from "@api/api/subscriptions/api"
import { AxiosError, AxiosRequestConfig } from "axios"
import { randomBytes, randomUUID } from "node:crypto"
import { before, describe, it } from "node:test"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import assert from "node:assert"

describe("Subscriptions Auth Tests", () => {
  const dbAdmin = database.core.createClient(database.core.getEnvVars().DB_URL)
  const api = testutils.getApi()

  before(async () => {
    await testutils.wipeDB(dbAdmin, database.schema.blockFeed.schemaName)
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

  const testFunctions = [
    {
      name: "find many",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.subscriptionsFindMany(undefined, undefined, config),
    },
    {
      name: "find one",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.subscriptionsFindOne(randomUUID(), config),
    },
    {
      name: "create",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.subscriptionsCreate(
          {
            name: randomUUID(),
            cursorId: randomBytes(
              subscriptionsAPI.CONSTANTS.CURSOR_ID.MAX_LEN / 2
            )
              .toString("hex")
              .slice(0, subscriptionsAPI.CONSTANTS.CURSOR_ID.MAX_LEN),
          },
          config
        ),
    },
    {
      name: "remove",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.subscriptionsRemove({ id: randomUUID() }, config),
    },
    {
      name: "update",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.subscriptionsUpdate(
          { id: randomUUID(), name: "new-name" },
          config
        ),
    },
  ]

  it("Blocks bad requests", async () => {
    const tests = testFunctions.flatMap((f) =>
      args.map((a) => ({ func: f, args: a }))
    )
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
