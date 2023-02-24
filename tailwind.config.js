/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        inter: ['var(--font-inter)', 'sans-serif'],
      },
    },
    fontFamily: {
      sans: ['var(--font-open-sans)', 'sans-serif'],
    },
  },
  plugins: [],
}
