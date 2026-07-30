import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111318",
        paper: "#F7F5F0",
        surface: "#FFFFFF",
        signal: "#F05A34",
        cobalt: "#3157D5",
        success: "#287A56",
        warning: "#8A5A10",
        danger: "#C33B3B",
        border: "#DDDCD7",
        muted: "#676B73",
        "hover-surface": "rgba(49, 87, 213, 0.08)",
        "selected-surface": "rgba(240, 90, 52, 0.12)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "sans-serif"],
        serif: ["var(--font-source-serif-4)", "serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      boxShadow: {
        soft: "0 10px 35px rgba(17, 19, 24, 0.08)",
        rail: "0 1px 0 rgba(17, 19, 24, 0.08)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
      },
      spacing: {
        18: "4.5rem",
      },
      zIndex: {
        dropdown: "1000",
        sticky: "1100",
        overlay: "1200",
        modal: "1300",
      },
    },
  },
  plugins: [],
} satisfies Config;
