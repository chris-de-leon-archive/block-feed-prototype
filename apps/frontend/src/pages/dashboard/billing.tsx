import { withStripeSubscriptionRequired } from "@block-feed/guards/with-stripe-subscription-required"
import { DashboardLoading } from "@block-feed/components/dashboard/loading"
import { DashboardLayout } from "@block-feed/layouts/dashboard.layout"
import * as client from "@block-feed/client"
import { useRouter } from "next/router"
import { useEffect } from "react"

export default withStripeSubscriptionRequired(({ user }) => {
  const router = useRouter()

  const sessionCreator = client.useGraphQLDashboardMutation(
    client.graphql(
      "mutation CreateBillingPortalSession {\n  createBillingPortalSession {\n    url\n  }\n}",
    ),
    {
      onSuccess: (data) => {
        router.push(data.createBillingPortalSession.url)
      },
    },
  )

  useEffect(() => {
    sessionCreator.mutate({})
  }, [])

  return (
    <DashboardLayout ctx={{ user }}>
      <DashboardLoading />
    </DashboardLayout>
  )
})
