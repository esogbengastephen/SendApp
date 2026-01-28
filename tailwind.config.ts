import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // New color palette from design guide
        primary: "#00BFFF", // Sky Blue - main brand color (vibrant medium to bright sky-blue)
        secondary: "#FFFFFF", // White - secondary brand color
        "background-light": "#FFFFFF", // White
        "background-dark": "#011931", // Dark Blue/Navy
        "card-dark": "#011931", // Dark Blue/Navy
        "card-light": "#FFFFFF", // White
        // Additional colors from palette
        "light-blue": "#D3E0EF", // Light Blue/Grey
        "light-grey": "#D1D3D4", // Light Grey
        "medium-grey": "#A7A9AC", // Medium Grey
        black: "#000000", // Black
        white: "#FFFFFF", // White
        // Keep accent for backward compatibility (using primary blue)
        "accent-green": "#00BFFF", // Using primary sky blue instead of green
        // Text colors for readability
        "text-primary": "#1F2937", // Dark gray for light mode text
        "text-primary-dark": "#FFFFFF", // White for dark mode text
        // Design system tokens (CSS vars for light/dark)
        "ds-primary": "var(--color-primary)",
        "ds-surface-strong": "var(--color-surface-strong)",
        "ds-surface-soft": "var(--color-surface-soft)",
        "ds-bg-light": "var(--color-bg-light)",
        "ds-border": "var(--color-border)",
        "ds-text-primary": "var(--text-primary)",
        "ds-text-secondary": "var(--text-secondary)",
        "ds-text-muted": "var(--text-muted)",
        "ds-dark-bg": "var(--dark-bg)",
        "ds-dark-surface": "var(--dark-surface)",
        "ds-dark-surface-soft": "var(--dark-surface-soft)",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        display: ["Inter", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "1rem",
        xl: "1.5rem",
        "2xl": "2rem",
        "3xl": "2.5rem",
        "ds-sm": "var(--radius-sm)",
        "ds-md": "var(--radius-md)",
        "ds-lg": "var(--radius-lg)",
        "ds-xl": "var(--radius-xl)",
      },
      boxShadow: {
        "ds-soft": "var(--shadow-soft)",
        "ds-base": "var(--shadow-base)",
      },
      spacing: {
        "ds-2": "var(--space-2)",
        "ds-3": "var(--space-3)",
        "ds-4": "var(--space-4)",
        "ds-5": "var(--space-5)",
        "ds-6": "var(--space-6)",
        "ds-7": "var(--space-7)",
        "ds-8": "var(--space-8)",
      },
      transitionDuration: {
        "motion-fast": "120ms",
        "motion-base": "180ms",
        "motion-slow": "260ms",
      },
      transitionTimingFunction: {
        "ease-standard": "cubic-bezier(0.2, 0, 0.2, 1)",
        "ease-exit": "cubic-bezier(0.4, 0, 1, 1)",
      },
      keyframes: {
        popIn: {
          "0%": { transform: "translateY(-50%) scale(0.8)" },
          "50%": { transform: "translateY(-50%) scale(1.1)" },
          "100%": { transform: "translateY(-50%) scale(1)" },
        },
        "card-enter": {
          "0%": { transform: "translateY(6px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
      animation: {
        popIn: "popIn 0.3s ease-out",
        "card-enter": "card-enter 180ms cubic-bezier(0.2, 0, 0.2, 1)",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
export default config;
