import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg:                   "oklch(var(--color-bg-raw) / <alpha-value>)",
        surface:              "oklch(var(--color-surface-raw) / <alpha-value>)",
        "surface-elevated":   "oklch(var(--color-surface-elevated-raw) / <alpha-value>)",
        border:               "oklch(var(--color-border-raw) / <alpha-value>)",
        ink:                  "oklch(var(--color-ink-raw) / <alpha-value>)",
        muted:                "oklch(var(--color-muted-raw) / <alpha-value>)",
        primary:              "oklch(var(--color-primary-raw) / <alpha-value>)",
        "primary-hover":      "oklch(var(--color-primary-hover-raw) / <alpha-value>)",
        accent:               "oklch(var(--color-accent-raw) / <alpha-value>)",
        success:              "oklch(var(--color-success-raw) / <alpha-value>)",
        warning:              "oklch(var(--color-warning-raw) / <alpha-value>)",
        error:                "oklch(var(--color-error-raw) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        sm:    "4px",
        DEFAULT: "8px",
        md:    "8px",
        lg:    "12px",
        pill:  "9999px",
      },
    },
  },
  plugins: [],
};
export default config;
