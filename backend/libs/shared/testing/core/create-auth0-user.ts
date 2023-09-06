import * as crypto from "node:crypto"
import { auth0 } from "../../auth0"

const createPassword = (length = 10) => {
  // Define character sets
  const lowerCase = "abcdefghijklmnopqrstuvwxyz"
  const upperCase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
  const digits = "0123456789"
  const specialChars = "!@#$%^&*"

  // Combine character sets
  const allChars = lowerCase + upperCase + digits + specialChars

  // Generate a password
  const password: string[] = []
  for (let i = 0; i < length; i++) {
    password.push(allChars[crypto.randomInt(allChars.length)])
  }

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
  client: ReturnType<(typeof auth0)["createClient"]>
) => {
  const info = createUserInfo()

  const user = await client.management.createUser({
    connection: "Username-Password-Authentication",
    username: info.username,
    email: info.email,
    password: info.password,
  })

  return {
    getInfo() {
      return user
    },
    async getGrant() {
      return await client.authentication.passwordGrant({
        username: info.username,
        password: info.password,
      })
    },
    async cleanUp() {
      const id = user.user_id
      if (id != null) {
        await client.management.deleteUser({ id })
      }
    },
  }
}
