import { Header } from "../components/shared/header"
import { Footer } from "../components/shared/footer"
import Head from "next/head"
import React from "react"

export type LandingPageLayoutProps = React.PropsWithChildren

export function LandingPageLayout(props: LandingPageLayoutProps) {
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
