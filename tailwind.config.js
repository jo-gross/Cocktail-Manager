module.exports = {
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        print: { raw: 'print' },
      },
    },
  },
  plugins: [require('daisyui')],

  daisyui: {
    themes: ['autumn', 'halloween'],
    darkTheme: 'halloween', // name of one of the included themes for dark mode
  },
};
// module.exports = {
//     content: ['./pages/**/*.{js,ts,jsx,tsx}'],
//     plugins: [require('daisyui')],
// };
