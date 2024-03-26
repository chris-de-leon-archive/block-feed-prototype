import { DashboardLayout } from "@block-feed/layouts/dashboard.layout"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"

export default withPageAuthRequired(({ user }) => {
  return <DashboardLayout ctx={{ user }}></DashboardLayout>
})
