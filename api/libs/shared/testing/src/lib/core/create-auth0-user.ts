import { auth0 } from "@api/shared/auth0"
import * as crypto from "node:crypto"

const createPassword = (length = 10) => {
  // Define character sets
  const lowerCase = "abcdefghijklmnopqrstuvwxyz"
  const upperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const digits = "0123456789"
  const specialChars = "!@#$%^&*"

  // Combine character sets
  const allChars = lowerCase + upperCase + digits + specialChars

  // Generate a password
  const password = Array({ length }).map(
    () => allChars[crypto.randomInt(allChars.length)]
  )

  // Return the password
  return password.join()
}

const createUserInfo = () => {
  const id = crypto.randomBytes(5).toString("hex").slice(0, 14)
  return {
    username: `u${id}`,
    password: createPassword(),
    email: `u${id}@fakemail.com`,
  }
}

export const createAuth0User = async (
  client: ReturnType<typeof auth0.createClient>
) => {
  const info = createUserInfo()

  const payload = await client.management.users.create({
    connection: "Username-Password-Authentication",
    username: info.username,
    email: info.email,
    password: info.password,
  })

  return {
    getInfo() {
      return payload.data
    },
    async getGrant() {
      return await client.oauth
        .passwordGrant({
          username: info.username,
          password: info.password,
        })
        .then(({ data }) => data)
    },
    async cleanUp() {
      const id = payload.data.user_id
      if (id != null) {
        await client.management.users.delete({ id })
      }
    },
  }
}
