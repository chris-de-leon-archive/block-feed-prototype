import { auth0 } from "@api/shared/auth0"
import * as crypto from "node:crypto"

const createUserInfo = () => {
  const id = crypto.randomBytes(5).toString("hex").slice(0, 14)
  return {
    username: `u${id}`,
    password: "I<a??<J%)CQRtWw",
    email: `u${id}@fakemail.com`,
  }
}

export const createAuth0User = async (
  client: ReturnType<typeof auth0.core.createClient>,
) => {
  const info = createUserInfo()

  const payload = await client.management.users.create({
    connection: "Username-Password-Authentication",
    username: info.username,
    email: info.email,
    password: info.password,
  })

  const grant = await client.oauth
    .passwordGrant({
      username: info.username,
      password: info.password,
    })
    .then(({ data }) => data)

  return {
    id: payload.data.user_id,
    accessToken: grant.access_token,
    async cleanUp() {
      const id = payload.data.user_id
      if (id != null) {
        await client.management.users.delete({ id })
      }
    },
  }
}
