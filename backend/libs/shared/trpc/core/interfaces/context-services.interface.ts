import { database } from "../../../database"
import { auth0 } from "../../../auth0"

export interface ContextServices {
  readonly database: ReturnType<(typeof database)["createClient"]>
  readonly auth0: ReturnType<(typeof auth0)["createClient"]>
}
