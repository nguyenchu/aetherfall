import { defineConfig } from 'vite';

// base: './' lets the build live in a subfolder, such as nguyenchu.com/aetherfall.
// og senere pakkes inn med Capacitor uten endringer.
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    target: 'es2022',
    // Phaser itself is the overwhelming majority of the bundle (a large,
    // rarely-changing dependency) — splitting it into its own chunk lets
    // browsers cache it independently from app code, so a future gameplay
    // change doesn't force players to re-download the engine too. Doesn't
    // shrink the total download (was 1,830KB/437KB gzip as one chunk; now
    // 348KB/98KB app + 1,482KB/338KB phaser — same total, just separated),
    // which is what was actually actionable here without lazy-loading
    // scenes (the whole game needs to boot together regardless, so
    // scene-level code-splitting wouldn't reduce the initial load).
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
    // The app chunk now comfortably clears the default 500KB warning: this
    // raises it just enough to stop flagging Phaser's own chunk, which is
    // inherent to the engine and isn't an app-code regression to fix.
    chunkSizeWarningLimit: 1600,
  },
});
