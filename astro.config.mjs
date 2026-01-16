import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',              // required for GitHub Pages
  base: '/website-samsara/',     // must match your repo name
});