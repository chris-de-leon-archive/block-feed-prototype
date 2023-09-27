export const getOptionalEnvVar = (key: string) => {
  return process.env[key]
}
