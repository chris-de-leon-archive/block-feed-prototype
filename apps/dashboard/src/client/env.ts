import { z } from "zod"

// NEXT_PUBLIC_ variables are replaced at build time, so
// using z.object({ ... }).parse(process.env) won't work
export const env = {
  NEXT_PUBLIC_API_URL: z
    .string()
    .url()
    .min(1)
    .parse(process.env["NEXT_PUBLIC_API_URL"]),
  NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL: z
    .string()
    .url()
    .min(1)
    .parse(process.env["NEXT_PUBLIC_STRIPE_CUSTOMER_PORTAL_URL"]),
}
