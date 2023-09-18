import { auth0 } from "@api/shared/auth0"

export type Auth0Ctx = Readonly<{
  auth0: ReturnType<typeof auth0.createClient>
}>
