import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'http://localhost:2567',
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      shared: path.resolve(__dirname, '../shared/src'),
    },
  },
  // Replace process.env references at build time so shared/constants works in the browser.
  // The client is never in TEST_MODE, so this resolves to the production values.
  define: {
    'process.env.TEST_MODE': JSON.stringify(''),
  },
});
