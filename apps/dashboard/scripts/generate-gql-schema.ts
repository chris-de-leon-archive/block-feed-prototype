import { builder } from "../src/server"
import { printSchema } from "graphql"
import * as fs from "node:fs"

fs.writeFileSync("schema.graphql", printSchema(builder.toSchema()))
