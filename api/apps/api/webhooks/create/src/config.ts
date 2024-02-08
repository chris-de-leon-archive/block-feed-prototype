import { WebhooksAPI } from "@api/api/webhooks/api"
import { AWS } from "@serverless/typescript"
import { utils } from "@api/shared/utils"
import * as path from "path"

export const config: AWS["functions"] = {
  [WebhooksAPI.OPERATIONS.CREATE.ID]: {
    environment: utils.resolveEnvVars(WebhooksAPI.ENV_FILES),
    logRetentionInDays: 1,
    handler: path.join(
      path.dirname(path.relative(process.cwd(), __filename)),
      "main.handler",
    ),
    events: [
      {
        http: {
          operationId: WebhooksAPI.OPERATIONS.CREATE.NAME,
          path: WebhooksAPI.OPERATIONS.CREATE.PATH,
          method: WebhooksAPI.OPERATIONS.CREATE.METHOD,
        },
      },
    ],
  },
}
