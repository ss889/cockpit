import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      animation: {
        bounce: 'bounce 1s infinite',
      },
      transitionDelay: {
        '100': '100ms',
        '200': '200ms',
      },
    },
  },
  plugins: [],
};

export default config;
