"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { UserProvider } from "@auth0/nextjs-auth0/client"
import { useState } from "react"

// https://tanstack.com/query/v4/docs/framework/react/guides/ssr#using-the-app-directory-in-nextjs-13
export default function Providers({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>{children}</UserProvider>
    </QueryClientProvider>
  )
}
