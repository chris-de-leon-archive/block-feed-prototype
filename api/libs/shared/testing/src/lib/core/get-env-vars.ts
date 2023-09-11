export const getEnvVars = () => {
  const url = process.env["TEST_LOCALSTACK_URL"]

  if (url == null) {
    throw new Error(`environment variable "TEST_LOCALSTACK_URL" is not defined`)
  }

  return {
    url,
  }
}
