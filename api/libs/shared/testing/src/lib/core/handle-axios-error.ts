import { AxiosError } from "axios"

export const handleAxiosError = (err: unknown) => {
  if (err instanceof AxiosError) {
    throw new Error(JSON.stringify(err.response?.data, null, 2))
  }
  throw err
}
