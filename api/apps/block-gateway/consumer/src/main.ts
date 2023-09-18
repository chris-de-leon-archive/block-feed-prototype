import { blockgateway } from "@api/block-gateway"
import { database } from "@api/shared/database"
import { rabbitmq } from "@api/shared/rabbitmq"
import { aws } from "@api/shared/aws"

const main = async () => {
  await new blockgateway.consumer.BlockConsumer(
    blockgateway.utils.resolveChainFromEnv(),
    await rabbitmq.createClient(),
    database.core.createClient(),
    aws.lambda.createClient()
  ).run()
}

main()
