import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    borderRadius: {
      none:    "0px",
      sm:      "0px",
      DEFAULT: "0px",
      md:      "0px",
      lg:      "0px",
      xl:      "0px",
      "2xl":   "0px",
      "3xl":   "0px",
      full:    "9999px",
    },
    extend: {
      colors: {
        rm: {
          bg:       "#000000",
          surface:  "#111111",
          surface2: "#1a1a1a",
          border:   "#222222",
          accent:   "#CCFF00",
          text:     "#FFFFFF",
          muted:    "#666666",
          faint:    "#333333",
        },
      },
    },
  },
  plugins: [],
};
export default config;
