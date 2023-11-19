import { AxiosError, AxiosRequestConfig } from "axios"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import { randomUUID } from "node:crypto"
import { describe, it } from "node:test"
import assert from "node:assert"

describe("Relayers Auth Tests", () => {
  const api = testutils.getApi()

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
        await api.relayersFindMany(undefined, undefined, config),
    },
    {
      name: "find one",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.relayersFindOne(randomUUID(), config),
    },
    {
      name: "create",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.relayersCreate(
          {
            name: randomUUID(),
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
          config,
        ),
    },
    {
      name: "remove",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.relayersRemove({ id: randomUUID() }, config),
    },
    {
      name: "update",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await api.relayersUpdate(
          { id: randomUUID(), name: "new-name" },
          config,
        ),
    },
  ]

  it("Blocks bad requests", async () => {
    await Promise.allSettled(
      testFunctions
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
