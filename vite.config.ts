import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { sentryVitePlugin } from '@sentry/vite-plugin';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      // Upload source maps to Sentry only when auth token is provided (CI/production builds)
      ...(env.SENTRY_AUTH_TOKEN && env.VITE_SENTRY_DSN
        ? [
            sentryVitePlugin({
              org: env.SENTRY_ORG,
              project: env.SENTRY_PROJECT,
              authToken: env.SENTRY_AUTH_TOKEN,
              sourcemaps: { assets: './dist/**' },
              telemetry: false,
            }),
          ]
        : []),
    ],
    build: {
      sourcemap: true,
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
