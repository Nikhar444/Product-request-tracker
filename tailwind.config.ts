import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#5B2D8E",
          "purple-dark": "#4A2574",
          "purple-light": "#F3EEFF",
          "purple-mid": "#7C4DB8",
        },
        stage: {
          complete: "#1D9E75",
          "complete-light": "#E1F5EE",
          active: "#D97706",
          "active-light": "#FEF3C7",
          pending: "#9CA3AF",
          "pending-light": "#F3F4F6",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
      },
      animation: {
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "slide-up": "slide-up 0.4s ease-out forwards",
      },
      keyframes: {
        "pulse-ring": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(29, 158, 117, 0.4)" },
          "50%": { boxShadow: "0 0 0 8px rgba(29, 158, 117, 0)" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
