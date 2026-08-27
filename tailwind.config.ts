import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        table: {
          felt: "var(--table-felt)",
          rail: "var(--table-rail)",
        },
        chip: {
          DEFAULT: "var(--chip)",
          gold: "var(--chip-gold)",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "deal-card": {
          "0%": { transform: "translateY(-40px) scale(0.8)", opacity: "0" },
          "100%": { transform: "translateY(0) scale(1)", opacity: "1" },
        },
        "pulse-turn": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(250, 204, 21, 0.6)" },
          "50%": { boxShadow: "0 0 0 8px rgba(250, 204, 21, 0)" },
        },
      },
      animation: {
        "deal-card": "deal-card 250ms ease-out",
        "pulse-turn": "pulse-turn 1.2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
