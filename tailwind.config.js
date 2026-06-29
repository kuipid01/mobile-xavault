/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./screens/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#063B2E",
        secondary: "#0F6B4F",
        tertiary: "#D6A84F",
        neutral: "#D6A84F",
        xavaultDark: "#042A1D",
        text: "#404945",
        border: "#717975",
        hash: "#F6F7FB",
      },
    },
  },
  plugins: [],
};
