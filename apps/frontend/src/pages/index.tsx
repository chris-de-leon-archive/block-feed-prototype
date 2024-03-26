import { Applications } from "@block-feed/components/home/applications"
import { RequestDemo } from "@block-feed/components/home/request-demo"
import { LandingPageLayout } from "@block-feed/layouts/landing.layout"
import { PageBreak } from "@block-feed/components/shared/page-break"
import { Features } from "@block-feed/components/home/features"
import { Workflow } from "@block-feed/components/home/workflow"
import { Banner } from "@block-feed/components/home/banner"
import { Quote } from "@block-feed/components/home/quote"
import { Stats } from "@block-feed/components/home/stats"

export default function Index() {
  return (
    <LandingPageLayout>
      <Banner />
      <PageBreak />
      <Quote />
      <PageBreak />
      <Features />
      <PageBreak />
      <Stats />
      <PageBreak />
      <Workflow />
      <PageBreak />
      <Applications />
      <PageBreak />
      <RequestDemo />
    </LandingPageLayout>
  )
}
