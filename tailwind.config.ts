import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        monarque: {
          50: "#faf8f5",
          100: "#f3ede3",
          200: "#e6d7c3",
          300: "#d5bc9d",
          400: "#c29d75",
          500: "#ab8153",
          600: "#946943",
          700: "#795337",
          800: "#644430",
          900: "#53392a",
          gold: "#c5a059",
          "gold-light": "#e8d7b5",
          dark: "#1c1917",
          card: "#ffffff",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Playfair Display", "Georgia", "serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
