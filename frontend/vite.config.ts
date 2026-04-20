import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },

  build: {
    // Smaller chunks = faster first load
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — cached for long time
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Charts library (largest dep) — isolated chunk
          'charts': ['recharts'],
          // Date utilities
          'dates': ['date-fns'],
          // UI utilities
          'ui': ['lucide-react', 'react-hot-toast'],
        },
      },
    },
    // Enable minification optimizations
    minify: 'esbuild',
    sourcemap: false,
    // Target modern browsers for smaller output
    target: 'es2020',
  },
});
