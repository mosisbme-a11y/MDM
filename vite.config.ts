import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Lightweight Vite dev middleware to handle /api routes locally when external backend on 3001 is not active
function devApiFallbackPlugin(): Plugin {
  return {
    name: 'dev-api-fallback',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) {
          return next();
        }

        const sendJson = (data: any, status = 200) => {
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
        };

        if (url.startsWith('/api/uploaded-files')) {
          return sendJson({ files: [], count: 0 });
        }

        if (url.startsWith('/api/master-data-logs')) {
          return sendJson({ logs: [] });
        }

        if (url.startsWith('/api/health')) {
          return sendJson({ ok: true, devMode: true });
        }

        if (url.startsWith('/api/system-master-data/manifest')) {
          return sendJson({ revision: 1, datasets: {} });
        }

        if (url.startsWith('/api/system-master-data/status')) {
          return sendJson({ status: 'ok', offline: true });
        }

        if (url.startsWith('/api/system-master-data')) {
          return sendJson({ success: true, offline: true });
        }

        if (url.startsWith('/api/admin/users')) {
          return sendJson({ users: [] });
        }

        return sendJson({ success: true, offline: true, files: [], data: [] });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devApiFallbackPlugin()],
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
  preview: {
    port: 3000,
    host: '0.0.0.0',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('xlsx') || id.includes('jspdf') || id.includes('html2canvas')) {
              return 'vendor-export';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }
        },
      },
    },
  },
});
