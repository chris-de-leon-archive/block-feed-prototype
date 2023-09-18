import { blockgateway } from "@api/block-gateway"
import { database } from "@api/shared/database"
import { rabbitmq } from "@api/shared/rabbitmq"

const main = async () => {
  await new blockgateway.producer.BlockProducer(
    blockgateway.utils.resolveChainFromEnv(),
    await rabbitmq.createClient(),
    database.core.createClient()
  ).run(5000)
}

main()
