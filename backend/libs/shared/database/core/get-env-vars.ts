export const getEnvVars = () => {
  const dbUrl = process.env["DB_URL"]
  if (dbUrl == null) {
    throw new Error(`environment variable "DB_URL" is not defined`)
  }

  return {
    url: dbUrl,
  }
}
