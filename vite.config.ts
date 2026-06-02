import { defineConfig } from 'vite';

// base: './' gjør at byggen kan ligge i en undermappe (f.eks. nguyenchu.com/aetherfall)
// og senere pakkes inn med Capacitor uten endringer.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { target: 'es2022' },
});
