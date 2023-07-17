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
    themes: ['bumblebee', 'halloween'],
  },
};
// module.exports = {
//     content: ['./pages/**/*.{js,ts,jsx,tsx}'],
//     plugins: [require('daisyui')],
// };
