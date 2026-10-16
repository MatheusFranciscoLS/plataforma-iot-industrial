import animate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
// As cores vêm de variáveis CSS (src/index.css), que mudam entre o tema claro e o escuro.
const cor = (nome) => `rgb(var(--${nome}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        fundo: cor('fundo'),
        painel: cor('painel'),
        tinta: cor('tinta'),
        suave: cor('suave'),
        linha: cor('linha'),
        aco: cor('aco'),
        alarme: cor('alarme'),
        'alarme-fundo': cor('alarme-fundo'),
        // Nomes que os componentes shadcn/ui esperam, ligados à paleta do painel.
        background: cor('fundo'),
        foreground: cor('tinta'),
        primary: { DEFAULT: cor('aco'), foreground: cor('painel') },
        secondary: { DEFAULT: cor('painel'), foreground: cor('tinta') },
        destructive: { DEFAULT: cor('alarme'), foreground: cor('painel') },
        muted: { DEFAULT: cor('linha'), foreground: cor('suave') },
        accent: { DEFAULT: cor('linha'), foreground: cor('tinta') },
        popover: { DEFAULT: cor('painel'), foreground: cor('tinta') },
        input: cor('linha'),
        ring: cor('aco'),
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', 'sans-serif'],
        condensada: ['"Barlow Condensed"', 'Barlow', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [animate],
};
