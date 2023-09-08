import { funcsAPI } from "../../../../libs/api"
import { AWS } from "@serverless/typescript"
import { sharedConfig } from "../config"
import * as path from "path"

export const funcsCreateConfig: AWS["functions"] = {
  [funcsAPI.OPERATIONS.CREATE.ID]: {
    ...sharedConfig,
    handler: path.join(
      path.dirname(path.relative(process.cwd(), __filename)),
      "handler.handler"
    ),
    events: [
      {
        http: {
          operationId: funcsAPI.OPERATIONS.CREATE.NAME,
          path: funcsAPI.OPERATIONS.CREATE.PATH,
          method: funcsAPI.OPERATIONS.CREATE.METHOD,
        },
      },
    ],
  },
}
