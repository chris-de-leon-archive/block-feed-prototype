import * as defaultTheme from "tailwindcss/defaultTheme"
import type { Config } from "tailwindcss"

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    container: {
      padding: {
        DEFAULT: "30px",
        lg: "200px",
      },
    },
    extend: {
      colors: {
        "sky-blue": "#00c3ff",
        dashboard: "#030303",
      },
      fontFamily: {
        sans: [...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
} satisfies Config
