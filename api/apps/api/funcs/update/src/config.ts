import { funcsAPI } from "@api/api/funcs/api"
import { AWS } from "@serverless/typescript"
import { utils } from "@api/shared/utils"
import * as path from "path"

export const config: AWS["functions"] = {
  [funcsAPI.OPERATIONS.UPDATE.ID]: {
    environment: utils.resolveEnvVars(funcsAPI.ENV_FILES),
    logRetentionInDays: 1,
    handler: path.join(
      path.dirname(path.relative(process.cwd(), __filename)),
      "main.handler"
    ),
    events: [
      {
        http: {
          operationId: funcsAPI.OPERATIONS.UPDATE.NAME,
          path: funcsAPI.OPERATIONS.UPDATE.PATH,
          method: funcsAPI.OPERATIONS.UPDATE.METHOD,
        },
      },
    ],
  },
}
