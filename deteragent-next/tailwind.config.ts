import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "SFMono-Regular", "ui-monospace", "monospace"],
      },
      colors: {
        void: "#030712",
        ink: "#07111f",
        panel: "rgba(8, 17, 32, 0.72)",
        line: "rgba(137, 162, 255, 0.16)",
        cyanx: "#1de7ff",
        violetx: "#9a4dff",
        mintx: "#34f5a4",
        orangex: "#ff9d2f",
      },
      boxShadow: {
        glow: "0 0 32px rgba(154, 77, 255, 0.22)",
        cyan: "0 0 34px rgba(29, 231, 255, 0.18)",
        mint: "0 0 34px rgba(52, 245, 164, 0.18)",
      },
      keyframes: {
        breathe: {
          "0%, 100%": { opacity: "0.72", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.04)" },
        },
        stream: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(100%)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        breathe: "breathe 2s ease-in-out infinite",
        stream: "stream 1.6s linear infinite",
        rise: "rise 0.28s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
