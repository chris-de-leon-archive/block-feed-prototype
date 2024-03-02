import { generateOpenApiDocument } from "trpc-openapi"
import { router } from "@block-feed/server/routes"
import { randomUUID } from "node:crypto"
import * as fs from "node:fs/promises"

const openApiDocument = generateOpenApiDocument(router, {
  title: "Block Feed API",
  version: "1.0.0",
  baseUrl: "https://block-feed.io",
})

const filename = process.argv.at(2) ?? `${randomUUID()}.openapi.schema`
process.stdout.write("Generating Open API schema... ")
fs.writeFile(`${filename}.json`, JSON.stringify(openApiDocument, null, 2)).then(
  () => {
    console.log("done!")
  },
)
