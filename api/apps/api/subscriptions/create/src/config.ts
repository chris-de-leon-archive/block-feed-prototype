import { subscriptionsAPI } from "@api/api/subscriptions/api"
import { AWS } from "@serverless/typescript"
import { utils } from "@api/shared/utils"
import * as path from "path"

export const config: AWS["functions"] = {
  [subscriptionsAPI.OPERATIONS.CREATE.ID]: {
    environment: utils.resolveEnvVars(subscriptionsAPI.ENV_FILES),
    logRetentionInDays: 1,
    handler: path.join(
      path.dirname(path.relative(process.cwd(), __filename)),
      "main.handler"
    ),
    events: [
      {
        http: {
          operationId: subscriptionsAPI.OPERATIONS.CREATE.NAME,
          path: subscriptionsAPI.OPERATIONS.CREATE.PATH,
          method: subscriptionsAPI.OPERATIONS.CREATE.METHOD,
        },
      },
    ],
  },
}
