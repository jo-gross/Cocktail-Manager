const plugin = require('tailwindcss/plugin');

module.exports = {
  content: ['./pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      screens: {
        print: { raw: 'print' },
      },
      aspectRatio: {
        '9/16': '9 / 16',
        '16/9': '16 / 9',
      },
    },
  },
  plugins: [
    // require('daisyui'),
    plugin(function ({ addVariant }) {
      addVariant('no-print', '@media not print');
    }),
  ],

  // daisyui: {
  //   themes: [
  //     'autumn',
  //     'halloween',
  //     {
  //       halloween: {
  //         ...require('daisyui/src/theming/themes')['halloween'],
  //         primary: '#f28c18',
  //         secondary: '#B51288',
  //         accent: '#51a800',
  //         neutral: '#2e1a05',
  //         'base-100': '#212121',
  //         info: '#22d3ee',
  //         success: '#65a30d',
  //         warning: '#db7706',
  //         error: '#dc2828',
  //       },
  //     },
  //   ],
  //   darkTheme: 'halloween',
  // },
};
