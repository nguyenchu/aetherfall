import { defineConfig } from 'vite';

// base: './' lets the build live in a subfolder, such as nguyenchu.com/aetherfall.
// og senere pakkes inn med Capacitor uten endringer.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { target: 'es2022' },
});
