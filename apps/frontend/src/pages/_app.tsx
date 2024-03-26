import "@block-feed/styles/styles.css"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { UserProvider } from "@auth0/nextjs-auth0/client"
import type { AppProps } from "next/app"

const queryClient = new QueryClient()

export default function App({ Component, pageProps }: AppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <Component {...pageProps} />
      </UserProvider>
    </QueryClientProvider>
  )
}
