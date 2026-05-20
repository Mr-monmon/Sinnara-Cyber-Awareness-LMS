import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // "hidden" generates source maps for Sentry without exposing them in the browser
    sourcemap: process.env.VITE_SENTRY_DSN ? "hidden" : false,
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
