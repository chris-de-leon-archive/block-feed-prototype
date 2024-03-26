import { Footer } from "@block-feed/components/shared/footer"
import { Header } from "../components/shared/header"
import Head from "next/head"

export type DocsLayoutProps = React.PropsWithChildren

export function DocsLayout(props: DocsLayoutProps) {
  return (
    <>
      <Head>
        <title>Block Feed</title>
      </Head>
      <div className="flex h-screen flex-col justify-between bg-landing">
        <Header />
        <main>{props.children}</main>
        <Footer />
      </div>
    </>
  )
}
