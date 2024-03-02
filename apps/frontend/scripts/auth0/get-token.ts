import { auth } from "@block-feed/server/vendor/auth0"
import { createInterface } from "node:readline"

const input = createInterface({
  input: process.stdin,
  output: process.stdout,
})

const main = async () => {
  const client = auth.client.create(auth.client.zEnv.parse(process.env))

  const email = await new Promise<string>((res) => {
    input.question("Auth0 Email: ", (answer) => {
      res(answer)
    })
  })

  const password = await new Promise<string>((res) => {
    input.question("Auth0 Password: ", (answer) => {
      res(answer)
    })
  })

  console.log("\nPassword Grant:")
  const grant = await client.oauth
    .passwordGrant({
      username: email,
      password: password,
    })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2))
      return result
    })

  console.log("\nProfile:")
  await client.userInfo.getUserInfo(grant.data.access_token).then((result) => {
    console.log(JSON.stringify(result, null, 2))
  })
}

main().finally(() => input.close())
