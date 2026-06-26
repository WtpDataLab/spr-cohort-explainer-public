import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./content/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand-ish neutral + the three streams. Kept as tokens so the
        // product and this tool can share one palette later (§10.5).
        ink: {
          DEFAULT: "#0f172a",
          soft: "#334155",
          faint: "#64748b",
        },
        protection: {
          DEFAULT: "#0e7490", // teal: rate-driven, stabilising
          soft: "#67e8f9",
        },
        excess: {
          DEFAULT: "#b45309", // amber: return-seeking, volatile
          soft: "#fdba74",
        },
        reserve: {
          DEFAULT: "#7c3aed", // violet: solidarity reserve
          soft: "#c4b5fd",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
