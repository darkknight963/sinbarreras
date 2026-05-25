/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gob: {
          blue: '#002C76', // oficial Gob.pe blue
          red: '#D3141A',  // oficial Gob.pe red
          dark: '#1D2939',
        }
      }
    },
  },
  plugins: [],
}
