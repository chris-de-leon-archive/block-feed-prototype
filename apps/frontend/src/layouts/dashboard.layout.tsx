import { Sidebar } from "@block-feed/components/dashboard/sidebar"
import { UserProfile } from "@auth0/nextjs-auth0/client"
import { Header } from "../components/dashboard/header"
import Head from "next/head"
import React from "react"

export type DashboardLayoutContext = Readonly<{
  user: UserProfile
}>

export type DashboardLayoutProps = React.PropsWithChildren &
  Readonly<{
    ctx: DashboardLayoutContext
  }>

export function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <>
      <Head>
        <title>Block Feed Dashboard</title>
      </Head>
      <div className="flex h-screen flex-col bg-dashboard">
        <main>
          <div className="flex flex-row bg-dashboard">
            <Sidebar />
            <div className="flex w-full flex-col items-center">
              <Header user={props.ctx.user} />
              {props.children}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
