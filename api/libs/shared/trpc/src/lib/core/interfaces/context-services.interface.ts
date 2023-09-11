import { database } from "@api/shared/database"
import { auth0 } from "@api/shared/auth0"

export interface ContextServices {
  readonly database: ReturnType<(typeof database)["createClient"]>
  readonly auth0: ReturnType<(typeof auth0)["createClient"]>
}
