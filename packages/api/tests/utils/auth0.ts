import type { Auth0Vendor } from "@block-feed/vendors"
import * as crypto from "node:crypto"

const createUserInfo = () => {
  const id = crypto.randomBytes(5).toString("hex").slice(0, 14)
  return {
    username: `u${id}`,
    password: "I<a??<J%)CQRtWw",
    email: `u${id}@fakemail.com`,
  }
}

export const createAuth0User = async (vendor: Auth0Vendor) => {
  const info = createUserInfo()

  const payload = await vendor.management.users
    .create({
      connection: "Username-Password-Authentication",
      username: info.username,
      email: info.email,
      password: info.password,
    })
    .catch((err) => {
      console.error(err)
      throw err
    })

  const grant = await vendor.oauth
    .passwordGrant({
      username: info.username,
      password: info.password,
    })
    .then(({ data }) => data)
    .catch((err) => {
      console.error(err)
      throw err
    })

  return {
    id: payload.data.user_id,
    accessToken: grant.access_token,
    async cleanUp() {
      const id = payload.data.user_id
      if (id != null) {
        await vendor.management.users.delete({ id })
      }
    },
  }
}
