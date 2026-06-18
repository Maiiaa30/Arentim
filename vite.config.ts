/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Security headers applied in dev so the app is exercised under the same CSP
// it ships with in production. Production headers are also configured at the
// host/CDN (see vercel.json / docs/SECURITY.md) — A02: Security Misconfiguration.
const securityHeaders: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'arentim-security-headers',
      configureServer(server) {
        server.middlewares.use((_req, res, next) => {
          for (const [key, value] of Object.entries(securityHeaders)) {
            res.setHeader(key, value);
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
