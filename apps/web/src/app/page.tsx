import { Applications } from "@block-feed/web/components/home/applications"
import { RequestDemo } from "@block-feed/web/components/home/request-demo"
import { PageBreak } from "@block-feed/web/components/shared/page-break"
import { Features } from "@block-feed/web/components/home/features"
import { Workflow } from "@block-feed/web/components/home/workflow"
import { Banner } from "@block-feed/web/components/home/banner"
import { Quote } from "@block-feed/web/components/home/quote"
import { Stats } from "@block-feed/web/components/home/stats"

export default function Index() {
  return (
    <main>
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
    </main>
  )
}
