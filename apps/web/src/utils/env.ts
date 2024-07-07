import { z } from "zod"

export const env = {
  NEXT_PUBLIC_DASHBOARD_URL: z
    .string()
    .url()
    .min(1)
    .parse(process.env["NEXT_PUBLIC_DASHBOARD_URL"]),
  NEXT_PUBLIC_GTAG: z
    .string()
    .optional()
    .parse(process.env["NEXT_PUBLIC_GTAG"]),
}
