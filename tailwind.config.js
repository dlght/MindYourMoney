/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        housing: "#6366f1",
        utilities: "#f59e0b",
        transport: "#3b82f6",
        groceries: "#22c55e",
        health: "#ef4444",
        subscriptions: "#a855f7",
        education: "#14b8a6",
        lifestyle: "#ec4899",
        debt: "#64748b",
        taxes: "#f97316",
        other: "#6b7280",
      },
    },
  },
  plugins: [],
};
