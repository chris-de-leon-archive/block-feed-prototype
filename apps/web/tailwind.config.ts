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
      keyframes: {
        "scroll-l": {
          from: {
            transform: "translateX(0%)",
          },
          to: {
            transform: "translateX(-100%)",
          },
        },
      },
      animation: {
        "scroll-l-infinite": "scroll-l 15s linear infinite",
      },
      backgroundImage: {
        // https://www.pexels.com/photo/tall-skyscrapers-of-modern-city-under-cloudy-sky-7077987/
        "mission-mobile": 'url("/about/our-mission-mobile.jpg")',

        // https://www.pexels.com/photo/skyscrapers-in-black-and-white-10786529/
        mission: 'url("/about/our-mission.jpg")',

        // https://www.pexels.com/photo/low-angle-shot-of-a-modern-skyscraper-16706160/
        story: 'url("/about/our-story.jpg")',

        // https://www.pexels.com/video/digital-projection-of-the-earth-mass-in-blue-lights-3129957/
        about: 'url("/about/about.jpg")',
      },
      colors: {
        "sky-blue": "#00c3ff",
        landing: "#151718",
      },
      fontFamily: {
        sans: [...defaultTheme.fontFamily.sans],
      },
    },
  },
  plugins: [],
} satisfies Config
