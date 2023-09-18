import { getEnvVars } from "./get-env-vars"
import { utils } from "@api/shared/utils"
import * as amqp from "amqplib"

export const createClient = async () => {
  const { url } = getEnvVars()

  const connection = await amqp.connect(url)

  utils.onShutdown(() => {
    connection.close()
  })

  return connection
}
