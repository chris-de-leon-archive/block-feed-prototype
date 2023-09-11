export const getEnvVars = () => {
  const url = process.env["TEST_BASE_PATH"]

  if (url == null) {
    throw new Error(`environment variable "TEST_BASE_PATH" is not defined`)
  }

  return {
    url,
  }
}
