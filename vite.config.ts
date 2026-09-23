import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ command }) => ({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  define: { 'process.env.NODE_ENV': JSON.stringify(command === 'build' ? 'production' : 'development') },
  plugins: [
    react(),
    {
      name: 'structura-development-entry',
      transformIndexHtml: {
        order: 'pre',
        handler(html, context) {
          if (!context.server) return html;
          return html
            .replace('<link rel="stylesheet" href="./assets/structura.css" />', '')
            .replace('<script defer src="./assets/structura.js"></script>', '<script type="module" src="/src/main.tsx"></script>');
        },
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: false,
    lib: {
      entry: fileURLToPath(new URL('./src/main.tsx', import.meta.url)),
      name: 'StructuraApp',
      formats: ['iife'],
      fileName: () => 'assets/structura.js',
      cssFileName: 'structura',
    },
    rolldownOptions: {
      output: { assetFileNames: 'assets/[name][extname]' },
    },
  },
}));