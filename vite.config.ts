import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';

// Phaser's source checks webpack-style build flags with `typeof FLAG`
// (see node_modules/phaser/config/webpack.config.js). Without a define each
// check sees the string "undefined" — truthy — so every optional branch
// (WebGL debug tooling, Camera3D, FBInstant, sound) gets bundled. Inlining the
// flags lets Rollup drop the dead branches and their requires.
const PHASER_FLAGS: Record<string, boolean> = {
  CANVAS_RENDERER: true,
  WEBGL_RENDERER: true,
  WEBGL_DEBUG: false,
  EXPERIMENTAL: false,
  PLUGIN_3D: false,
  PLUGIN_CAMERA3D: false,
  PLUGIN_FBINSTANT: false,
  FEATURE_SOUND: false,
};

function phaserFlags(): Plugin {
  const pattern = new RegExp(`typeof (${Object.keys(PHASER_FLAGS).join('|')})\\b`, 'g');
  return {
    name: 'aetherfall:phaser-flags',
    apply: 'build',
    enforce: 'pre',
    transform(code, id) {
      if (!/[\\/]phaser[\\/]src[\\/]/.test(id) || !code.includes('typeof ')) return null;
      return { code: code.replace(pattern, (_, flag: string) => String(PHASER_FLAGS[flag])), map: null };
    },
  };
}

// base: './' lets the build live in a subfolder, such as nguyenchu.com/aetherfall.
// og senere pakkes inn med Capacitor uten endringer.
export default defineConfig(({ command }) => ({
  base: './',
  server: { host: true, port: 5173 },
  plugins: [phaserFlags()],
  resolve: {
    // Production builds Phaser from source through a trimmed entry (no
    // physics, tilemaps or sound — see src/vendor/phaser-lite.js) instead of
    // the prebuilt dist/phaser.esm.js. Dev keeps the stock bundle so
    // optimizeDeps stays fast; `pnpm build && pnpm preview` is the check that
    // nothing the game needs was trimmed.
    alias: command === 'build'
      ? [{ find: /^phaser$/, replacement: fileURLToPath(new URL('./src/vendor/phaser-lite.js', import.meta.url)) }]
      : [],
  },
  build: {
    target: 'es2022',
    // Phaser is still most of the download and rarely changes, so it keeps
    // its own chunk: a gameplay update only re-fetches the small app chunk.
    // Scene-level lazy loading wouldn't help — every scene is registered at
    // boot and the game needs the engine before anything renders.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/[\\/]node_modules[\\/].*phaser[\\/]|[\\/]src[\\/]vendor[\\/]phaser-lite\.js$/.test(id)) return 'phaser';
        },
      },
    },
    // The trimmed Phaser chunk is ~1,030KB (~243KB gzip; the stock engine
    // was ~1,480KB). No engine fits Vite's 500KB default, so the limit sits
    // just above it — it should only fire if someone re-adds a heavy
    // namespace or the app chunk balloons.
    chunkSizeWarningLimit: 1100,
  },
}));
