/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        "wifi-bg": "#020617",
        "wifi-card": "#020617",
        "wifi-border": "rgba(148,163,184,0.35)"
      }
    }
  },
  plugins: []
};

export default config;

