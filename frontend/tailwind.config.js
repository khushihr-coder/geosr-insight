/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        isro: {
          navy: '#0b1629',
          deepBlue: '#0c2340',
          blue: '#1a56db',
          lightBlue: '#e8f0fe',
          accent: '#2563eb',
          orange: '#ff6f00',
          saffron: '#ff9933',
          green: '#138808',
          border: '#e2e8f0',
          panel: '#ffffff',
          bg: '#f4f6f9'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif']
      }
    },
  },
  plugins: [],
}
