import "@block-feed/dashboard/styles/styles.css"

import { Sidebar } from "../components/shared/sidebar"
import { Header } from "../components/shared/header"
import { Titillium_Web } from "next/font/google"
import type { Metadata } from "next"
import Providers from "./providers"
import { ReactNode } from "react"

const inter = Titillium_Web({
  subsets: ["latin"],
  weight: "300",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Block Feed Dashboard",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <div className="bg-dashboard flex h-screen flex-col">
            <main>
              <div className="bg-dashboard flex flex-row">
                <Sidebar />
                <div className="flex w-full flex-col items-center">
                  <Header />
                  {children}
                </div>
              </div>
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
