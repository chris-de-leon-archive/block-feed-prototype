export const getRequiredEnvVar = (key: string) => {
  const val = process.env[key]
  if (val == null) {
    throw new Error(`required environment variable "${key}" is not defined`)
  }
  return val
}
