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
          50: "#fbf8f4",
          100: "#f5ede2",
          200: "#ebd9c4",
          300: "#dec0a2",
          400: "#cda37f",
          500: "#ba865f",
          600: "#a3704d",
          700: "#86583d",
          800: "#6d4734",
          900: "#2b211b",
          gold: "#c59b4c",
          "gold-light": "#e8d5aa",
          orange: "#e05a1b",
          "orange-light": "#fef3ee",
          "orange-dark": "#b8420f",
          dark: "#231c18",
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
