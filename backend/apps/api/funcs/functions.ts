import { funcsFindManyConfig } from "./find-many/config"
import { funcsFindOneConfig } from "./find-one/config"
import { funcsCreateConfig } from "./create/config"
import { funcsRemoveConfig } from "./remove/config"
import { funcsUpdateConfig } from "./update/config"
import { AWS } from "@serverless/typescript"

export const funcsFunctions: AWS["functions"] = {
  ...funcsFindManyConfig,
  ...funcsFindOneConfig,
  ...funcsCreateConfig,
  ...funcsUpdateConfig,
  ...funcsRemoveConfig,
}
