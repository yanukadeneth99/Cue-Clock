/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        broadcast: {
          bg: "#1a1d23",
          surface: "#252830",
          "surface-border": "#353840",
          header: "#e8eaed",
          zone1: "#4ade80",
          zone2: "#f87171",
          countdown: "#fbbf24",
          muted: "#8b8f96",
          danger: "#ef4444",
          accent: "#60a5fa",
        },
      },
    },
  },
  plugins: [],
};
