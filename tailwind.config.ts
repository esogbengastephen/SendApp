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
      },
      keyframes: {
        popIn: {
          "0%": { transform: "translateY(-50%) scale(0.8)" },
          "50%": { transform: "translateY(-50%) scale(1.1)" },
          "100%": { transform: "translateY(-50%) scale(1)" },
        },
      },
      animation: {
        popIn: "popIn 0.3s ease-out",
      },
    },
  },
  plugins: [require("@tailwindcss/forms"), require("@tailwindcss/typography")],
};
export default config;
