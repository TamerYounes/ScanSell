import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"IBM Plex Sans"', "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
      colors: {
        paper: "#F5F6F3",
        ink: "#1D2421",
        muted: "#5F6B66",
        faint: "#8A948F",
        line: "#DDE1DC",
        wash: "#ECEFEA",
        pine: {
          DEFAULT: "#1F5F4A",
          dark: "#174A39",
          light: "#E3EEE9",
        },
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};

export default config;
