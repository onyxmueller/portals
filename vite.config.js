import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so the same build works on the website and inside the phone apps.
  base: './',
  build: { chunkSizeWarningLimit: 2000 }, // Phaser is big; that's expected
  server: { host: true },                 // let phones on the same Wi-Fi open the dev page
});
