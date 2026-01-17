/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./app/(app)/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#0056D2",
        success: "#107C10",
        warning: "#F37021",
        slate: "#2C3E50",
        background: "#F2F2F2",
      },
    },
  },
  plugins: [],
}
