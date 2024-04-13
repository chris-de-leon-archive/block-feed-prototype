import { auth0 } from "@block-feed/vendors"

const main = async () => {
  const client = auth0.client.create(auth0.client.zEnv.parse(process.env))

  while (true) {
    process.stdout.write("\nFetching a batch users... ")
    const users = await client.management.users.getAll({
      per_page: 10,
      page: 0,
    })
    console.log(`done! (${users.data.length} users found)`)

    if (users.data.length === 0) {
      break
    }

    for (const user of users.data) {
      process.stdout.write(`Deleting user with ID ${user.user_id}... `)
      await client.management.users.delete({
        id: user.user_id,
      })
      console.log("done!")

      // Helps avoid API rate limits
      await new Promise((res) => setTimeout(res, 3000))
    }
  }
}

main()
