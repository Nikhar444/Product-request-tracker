import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          purple: "#5B2D8E",
          "purple-dark": "#4A2574",
          "purple-light": "#F3EEFF",
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
    },
  },
  plugins: [],
};
export default config;
