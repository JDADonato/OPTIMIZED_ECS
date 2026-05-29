/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./resources/**/*.blade.php",
        "./resources/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                display: ['Outfit', 'sans-serif'],
            },
            colors: {
                brand: {
                    red: '#720101',
                    'red-dark': '#5a0101',
                    'red-light': '#8b1a1a',
                    gold: '#f0aa0b',
                    'gold-light': '#f5c44a',
                    'gold-dark': '#d4950a',
                    cream: '#fefdfd',
                    black: '#1a1a1a',
                    'black-soft': '#2d2d2d',
                },
                primary: {
                    50: '#fef7e7',
                    100: '#fdefc0',
                    500: '#f0aa0b',
                    600: '#d4950a',
                    700: '#b87f08',
                    800: '#720101',
                    900: '#5a0101',
                }
            },
            animation: {
                slideUp: 'slideUp 0.6s ease-out',
                slideUpSlow: 'slideUp 0.8s ease-out',
                fadeIn: 'fadeIn 0.5s ease-out',
                fadeInSlow: 'fadeIn 0.8s ease-out',
                scaleIn: 'scaleIn 0.5s ease-out',
                float: 'float 6s ease-in-out infinite',
            },
            keyframes: {
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(30px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                scaleIn: {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                float: {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-8px)' },
                },
            },
        },
    },
    plugins: [],
}
