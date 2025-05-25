// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}", // Scans all JS/JSX/TS/TSX files in your src folder
    "./public/index.html"       // Scans your main index.html
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        // You can define custom brand colors here if needed,
        // matching the purple/violet accent from your target image.
        // For example:
        // 'brand-purple': '#8B5CF6',
        // 'brand-purple-light': '#EDE9FE',
        // 'brand-purple-dark': '#5B21B6',
      },
      boxShadow: { // Adding some more distinct shadows
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        '3xl': '0 35px 60px -15px rgb(0 0 0 / 0.3)',
      },
      animation: { // For the modal and error display
        'modal-appear': 'modal-appear 0.2s ease-out forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
      },
      keyframes: {
        'modal-appear': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          from: { transform: 'translateX(100%)', opacity: '0'},
          to: { transform: 'translateX(0)', opacity: '1'},
        }
      }
    },
  },
  plugins: [
    // require('@tailwindcss/forms'), // Uncomment if you want pre-styled forms
  ],
}
