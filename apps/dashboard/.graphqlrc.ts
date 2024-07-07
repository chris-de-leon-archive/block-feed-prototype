import { CodegenConfig } from "@graphql-codegen/cli"
import { IGraphQLConfig } from "graphql-config"
import * as path from "node:path"
import * as fs from "node:fs"

const outputPath = path.join("src", "client", "generated/")

/**
 * https://github.com/neovim/nvim-lspconfig/blob/master/doc/server_configurations.md#graphql
 * https://the-guild.dev/graphql/config/docs/user/usage#extensions
 */
export default {
  schema: fs.readFileSync("./schema.graphql").toString(),
  documents: ["graphql/**/*.gql"],
  extensions: {
    codegen: {
      generates: {
        [outputPath]: {
          preset: "client",
          config: {
            enumsAsTypes: true,
          },
        },
      },
    } satisfies CodegenConfig,
  },
} satisfies IGraphQLConfig
