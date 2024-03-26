import { GraphQLClient } from "graphql-request"
import { getSdk } from "./client"

export const withSdk = (url: string) => {
  return getSdk(new GraphQLClient(url))
}
