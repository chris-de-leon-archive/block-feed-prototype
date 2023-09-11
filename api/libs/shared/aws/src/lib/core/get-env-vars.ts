export const getEnvVars = () => {
  const accessKey = process.env["AWS_ACCESS_KEY_ID"]
  const secretAccessKey = process.env["AWS_SECRET_ACCESS_KEY"]
  const region = process.env["AWS_REGION"]

  if (accessKey == null) {
    throw new Error(`environment variable "AWS_ACCESS_KEY_ID" is not defined`)
  }

  if (secretAccessKey == null) {
    throw new Error(
      `environment variable "AWS_SECRET_ACCESS_KEY" is not defined`
    )
  }

  if (region == null) {
    throw new Error(`environment variable "AWS_REGION" is not defined`)
  }

  return {
    accessKey,
    secretAccessKey,
    region,
  }
}
