import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      primary: "#1A5276",
      accent: "#E67E22",
      background: "#F8F6F2",
      surface: "#FFFFFF",
      success: "#1E8449",
      ink: "#1C1C1E",
      muted: "#6B7280",
      // Вторичный текст на фоне #F8F6F2: у #6B7280 там контраст 4.48:1 < WCAG AA 4.5:1.
      // Это ink (#1C1C1E) 65% поверх background — 5.15:1. На белых карточках — обычный muted
      "muted-bg": "#696868",
      // Красного в палитре DS нет, а он нужен для ошибок форм и кнопки «Выйти» (5.4:1 на белом)
      danger: "#C0392B",
      // Вторичный текст на синем хедере профиля (DS: «Подпись #A8C6D9»)
      "primary-soft": "#A8C6D9",
      border: "#E5E7EB",
      "deposit-bg": "#FEF3E2",
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 2px 12px rgba(0,0,0,0.07)",
        fab: "0 4px 16px rgba(230,126,34,0.4)",
      },
      borderRadius: {
        card: "16px",
        chip: "20px",
      },
      maxWidth: {
        content: "1200px",
      },
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(0, 0, 0.2, 1)",
      },
      transitionDuration: {
        DEFAULT: "200ms",
      },
    },
  },
  plugins: [],
};

export default config;
