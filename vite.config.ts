import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      include: ['react', 'react-dom'],
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true,
      hmr: process.env.DISABLE_HMR !== 'true',
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              // Ne pas surveiller les artefacts (build, installateur, données
              // SQLite) — fichiers volumineux et parfois verrouillés (EBUSY).
              ignored: ['**/release/**', '**/dist/**', '**/server/data/**', '**/server/server.bundle.mjs', '**/*.zip'],
            },
      // Le frontend dev est servi par Vite ; l'API SQLite reste sur :8787 si lancée
      proxy: {
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res) => {
              if (res && 'writeHead' in res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ ok: false, error: 'Serveur local injoignable' }));
              }
            });
          },
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            icons: ['lucide-react'],
          },
        },
      },
    },
  };
});
