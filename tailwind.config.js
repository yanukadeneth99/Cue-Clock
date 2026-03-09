/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        broadcast: {
          bg: "#0a0a0a",
          surface: "#161616",
          "surface-border": "#2a2a2a",
          header: "#e0e0e0",
          zone1: "#4ade80",
          zone2: "#f87171",
          countdown: "#facc15",
          muted: "#888888",
          danger: "#ef4444",
          accent: "#60a5fa",
        },
      },
    },
  },
  plugins: [],
};
