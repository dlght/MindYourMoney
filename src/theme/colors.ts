export const themeColors = {
  light: {
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
    accent: "#6366f1",
  },
  dark: {
    background: "#0f172a",
    surface: "#1e293b",
    text: "#f8fafc",
    textMuted: "#94a3b8",
    border: "#334155",
    accent: "#818cf8",
  },
} as const;

export type ThemeName = keyof typeof themeColors;
