/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './views/**/*.ejs',
    './public/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        rescue: {
          red: '#E63946',
          'red-dark': '#C1121F',
          'red-light': '#FF6B6B',
          white: '#FFFFFF',
          cream: '#FFF5F5',
          dark: '#1A1A2E',
          gray: '#F8F9FA',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Poppins', 'sans-serif'],
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      }
    }
  },
  plugins: [],
  safelist: [
    'from-red-400', 'to-red-600', 'from-teal-400', 'to-teal-600',
    'from-orange-400', 'to-orange-600', 'from-blue-400', 'to-blue-600',
    'from-purple-400', 'to-purple-600', 'from-amber-400', 'to-amber-600',
    'from-green-400', 'to-green-600', 'from-pink-400', 'to-pink-600',
    'from-gray-600', 'to-gray-800',
    'bg-gradient-to-br',
  ]
}
