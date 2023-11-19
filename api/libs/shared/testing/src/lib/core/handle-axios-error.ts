import * as assert from "node:assert"
import { AxiosError } from "axios"

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
