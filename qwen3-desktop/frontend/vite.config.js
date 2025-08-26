import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html')
      },
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          state: ['zustand'],
          network: ['axios', 'socket.io-client']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true,
    strictPort: true
  },
  preview: {
    port: 3000,
    host: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@pages': resolve(__dirname, 'src/pages'),
      '@services': resolve(__dirname, 'src/services'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@assets': resolve(__dirname, 'src/assets')
    }
  },
  define: {
    __DEV__: process.env.NODE_ENV === 'development'
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand']
  }
});
