import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths, so the same build works on the website and inside the phone apps.
  base: './',
  // Which commit this build came from (set by GitHub when it deploys; 'dev' on your own computer).
  // The web page compares it with the server's and reloads itself when the server is newer.
  define: { __BUILD__: JSON.stringify(process.env.GITHUB_SHA || 'dev') },
  build: { chunkSizeWarningLimit: 2000 }, // Phaser is big; that's expected
  server: { host: true },                 // let phones on the same Wi-Fi open the dev page
});
