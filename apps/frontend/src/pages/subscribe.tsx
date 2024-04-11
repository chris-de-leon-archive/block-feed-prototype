import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { handleError } from "@block-feed/client/errors"
import * as client from "@block-feed/client"
import React, { useEffect } from "react"
import { useRouter } from "next/router"

export default withPageAuthRequired(() => {
  const router = useRouter()

  const sessionCreator = client.useGraphQLMutation(
    client.graphql(
      "mutation CreateCheckoutSession {\n  createCheckoutSession {\n    url\n  }\n}",
    ),
    {
      onError: (err) => {
        // NOTE: we don't need to handle NOT_SUBSCRIBED or INVALID_SUBSCRIPTION
        // errors here since the user is currently in the process of subscribing
        handleError(err, {
          onExpiredAccessTokenError: () => {
            router.push("/api/auth/login?returnTo=/subscribe")
          },
          onUnauthorizedError: () => {
            router.push("/api/auth/logout")
          },
          onError: () => {
            router.push("/error")
          },
        })
      },
      onSuccess: (data) => {
        router.push(data.createCheckoutSession.url)
      },
    },
  )

  useEffect(() => {
    sessionCreator.mutate({})
  }, [])

  return <></>
})
