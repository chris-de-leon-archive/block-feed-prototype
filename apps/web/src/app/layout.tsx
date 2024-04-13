import "@block-feed/web/styles/styles.css"

import { GoogleAnalytics } from "@next/third-parties/google"
import { Header } from "../components/shared/header"
import { Footer } from "../components/shared/footer"
import { Titillium_Web } from "next/font/google"
import type { Metadata } from "next"
import { env } from "../utils/env"

const inter = Titillium_Web({
  subsets: ["latin"],
  weight: "300",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Block Feed",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const gtag = env.NEXT_PUBLIC_GTAG
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen flex-col justify-between bg-landing">
          <Header />
          {children}
          <Footer />
        </div>
      </body>
      {gtag != null && <GoogleAnalytics gaId={gtag} />}
    </html>
  )
}
