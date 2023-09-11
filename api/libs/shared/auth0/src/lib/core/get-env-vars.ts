export const getEnvVars = () => {
  const clientSecret = process.env["AUTH0_CLIENT_SECRET"]
  if (clientSecret == null) {
    throw new Error(`environment variable "AUTH0_CLIENT_SECRET" is not defined`)
  }

  const clientId = process.env["AUTH0_CLIENT_ID"]
  if (clientId == null) {
    throw new Error(`environment variable "AUTH0_CLIENT_ID" is not defined`)
  }

  const domain = process.env["AUTH0_DOMAIN"]
  if (domain == null) {
    throw new Error(`environment variable "AUTH0_DOMAIN" is not defined`)
  }

  return {
    clientSecret,
    clientId,
    domain,
  }
}
