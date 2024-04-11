import { withPageAuthRequired, UserProfile } from "@auth0/nextjs-auth0/client"
import * as client from "@block-feed/client"

export function withStripeSubscriptionRequired(
  Component: React.ComponentType<{ user: UserProfile }>,
) {
  return withPageAuthRequired(({ user }) => {
    const stripeSubscriptionQuery = client.useGraphQLDashboardQuery(
      client.graphql(
        "query StripeSubscription {\n  stripeSubscription {\n    id\n    status\n  }\n}",
      ),
      {},
    )

    if (stripeSubscriptionQuery.data != null) {
      return <Component user={user} />
    }

    return <></>
  })
}
