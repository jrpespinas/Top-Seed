/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        muted: "var(--color-muted)",
        "muted-foreground": "var(--color-muted-foreground)",
        border: "var(--color-border)",
        primary: "var(--color-primary)",
        "primary-foreground": "var(--color-primary-foreground)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        danger: "var(--color-danger)",
        surface: "var(--color-surface)",
        court: "var(--color-court)",
        "court-foreground": "var(--color-court-foreground)",
        next: "var(--color-next)",
        "next-foreground": "var(--color-next-foreground)",
        attention: "var(--color-attention)",
        "attention-surface": "var(--color-attention-surface)",
      },
      borderRadius: {
        control: "var(--radius-control)",
        card: "var(--radius-card)",
      },
      spacing: {
        1: "var(--space-1)",
        2: "var(--space-2)",
        3: "var(--space-3)",
        4: "var(--space-4)",
        6: "var(--space-6)",
        8: "var(--space-8)",
      },
      fontSize: {
        caption: ["var(--text-caption)", { lineHeight: "1.4" }],
        body: ["var(--text-body)", { lineHeight: "1.5" }],
        label: ["var(--text-label)", { lineHeight: "1.3" }],
        title: ["var(--text-title)", { lineHeight: "1.35" }],
        heading: ["var(--text-heading)", { lineHeight: "1.25" }],
        display: ["var(--text-display)", { lineHeight: "1.15" }],
      },
      minHeight: {
        touch: "var(--size-touch-min)",
      },
      minWidth: {
        touch: "var(--size-touch-min)",
      },
    },
  },
  plugins: [],
};
