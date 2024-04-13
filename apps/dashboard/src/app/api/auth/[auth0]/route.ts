import { handleAuth, handleLogout } from "@auth0/nextjs-auth0"
import { z } from "zod"

const auth0Env = z
  .object({
    AUTH0_ISSUER_BASE_URL: z.string().url().min(1),
    AUTH0_CLIENT_ID: z.string().min(1),
    AUTH0_BASE_URL: z.string().url().min(1),
  })
  .parse(process.env)

const logoutUrl = new URL("v2/logout", auth0Env.AUTH0_ISSUER_BASE_URL)
logoutUrl.searchParams.append("client_id", auth0Env.AUTH0_CLIENT_ID)
logoutUrl.searchParams.append("returnTo", auth0Env.AUTH0_BASE_URL)

// https://github.com/auth0/nextjs-auth0/issues/362#issuecomment-816595953
// https://community.auth0.com/t/logging-out-completely/118940/5
export const GET = handleAuth({
  logout: handleLogout({
    returnTo: logoutUrl.href,
  }),
})
