import { funcsAPI } from "@api/api/funcs/api"
import { AWS } from "@serverless/typescript"
import { utils } from "@api/shared/utils"
import * as path from "path"

export const config: AWS["functions"] = {
  [funcsAPI.OPERATIONS.FIND_MANY.ID]: {
    environment: utils.resolveEnvVars(funcsAPI.ENV_FILES),
    logRetentionInDays: 1,
    handler: path.join(
      path.dirname(path.relative(process.cwd(), __filename)),
      "main.handler"
    ),
    events: [
      {
        http: {
          operationId: funcsAPI.OPERATIONS.FIND_MANY.NAME,
          path: funcsAPI.OPERATIONS.FIND_MANY.PATH,
          method: funcsAPI.OPERATIONS.FIND_MANY.METHOD,
        },
      },
    ],
  },
}
