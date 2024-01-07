import { after, before, describe, it } from "node:test"
import { AxiosError, AxiosRequestConfig } from "axios"
import { database } from "@api/shared/database"
import { testutils } from "@api/shared/testing"
import { createAppServer } from "./utils"
import { auth0 } from "@api/shared/auth0"
import { randomUUID } from "node:crypto"
import { k8s } from "@api/shared/k8s"
import { api } from "@api/api/core"
import assert from "node:assert"

describe("Relayers Auth Tests", () => {
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
    createAppServer(ctx, { verbose: false }),
  )

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

  const testFunctions = (sdk: ReturnType<typeof testutils.getApi>) => [
    {
      name: "find many",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await sdk.relayersFindMany(undefined, undefined, config),
    },
    {
      name: "find one",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await sdk.relayersFindOne(randomUUID(), config),
    },
    {
      name: "create",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await sdk.relayersCreate(
          {
            name: randomUUID(),
            deploymentId: randomUUID(),
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
        await sdk.relayersRemove({ id: randomUUID() }, config),
    },
    {
      name: "update",
      call: async (config: AxiosRequestConfig<unknown>) =>
        await sdk.relayersUpdate(
          { id: randomUUID(), name: "new-name" },
          config,
        ),
    },
  ]

  before(async () => {
    await appServer.start()
  })

  after(async () => {
    await testutils.runPromisesInOrder(
      [
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
    const sdk = testutils.getApi({
      basePath: appServer.getInfo().url,
    })

    await Promise.allSettled(
      testFunctions(sdk)
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
