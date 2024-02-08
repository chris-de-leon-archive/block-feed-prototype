import { Configuration, ConfigurationParameters, DefaultApi } from "./openapi"
import * as assert from "node:assert"
import { AxiosError } from "axios"

export const getApi = (params?: ConfigurationParameters) => {
  return new DefaultApi(new Configuration(params))
}

export const runPromisesInOrder = async (
  promises: Promise<unknown>[],
  onError: (err: unknown, i: number) => void | Promise<void>,
) => {
  for (let i = 0; i < promises.length; i++) {
    try {
      await promises[i]
    } catch (err) {
      await onError(err, i)
    }
  }
}

export const handleAxiosError = (err: unknown) => {
  if (err instanceof AxiosError) {
    assert.fail(JSON.stringify(err.response?.data, null, 2))
  }
  if (err instanceof Error || typeof err === "string") {
    assert.fail(err)
  }
  if (err === undefined) {
    assert.fail("unexpectedly received undefined error")
  }
  throw err
}
