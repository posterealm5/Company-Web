import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv, type Plugin} from 'vite';

const devDiagnosticsPlugin = (): Plugin => ({
  name: 'dev-diagnostics-endpoint',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/api/dev-diagnostics', (req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const timestamp = parsed.timestamp || new Date().toISOString();
            const logLine = `[DEV_DIAGNOSTIC] [${timestamp}] [${parsed.stage || 'GENERAL'}] ${JSON.stringify(parsed.data || parsed)}\n`;
            console.log('\x1b[33m%s\x1b[0m', `[DEV_DIAGNOSTIC] [${parsed.stage || 'GENERAL'}]`, parsed.data || parsed);
            fs.appendFileSync('payment-debug.log', logLine, 'utf8');
          } catch (e) {
            console.error('Failed to log dev diagnostic:', e);
          }
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok' }));
        });
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
  },
});

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), devDiagnosticsPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
