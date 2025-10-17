/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // ← AGGIUNTO: Abilita dark mode con classe 'dark'
  theme: {
    extend: {
      // ← AGGIUNTO: Colori custom per animazioni neon
      colors: {
        neon: {
          blue: '#00d4ff',
          purple: '#7b2ff7',
          pink: '#ff0080',
        }
      },
      // ← AGGIUNTO: Animazioni custom
      animation: {
        'glow': 'card-glow 2s ease-in-out infinite',
        'rotate-arrow': 'rotate-arrow 3s linear infinite',
        'pulse-badge': 'badge-pulse 2s ease-in-out infinite',
      },
      // ← AGGIUNTO: Ombre custom per effetti neon
      boxShadow: {
        'neon': '0 0 20px rgba(0, 212, 255, 0.4)',
        'neon-strong': '0 0 40px rgba(0, 212, 255, 0.6)',
      }
    },
  },
  plugins: [],
}
