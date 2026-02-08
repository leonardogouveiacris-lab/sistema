import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync } from 'fs';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-pdf-worker',
      buildStart() {
        const workerSrc = resolve(__dirname, 'node_modules/react-pdf/node_modules/pdfjs-dist/build/pdf.worker.min.mjs');
        const workerDest = resolve(__dirname, 'public/pdf.worker.min.mjs');
        try {
          copyFileSync(workerSrc, workerDest);
          console.log('✓ PDF.js worker file copied successfully');
        } catch (error) {
          console.error('Failed to copy PDF.js worker:', error);
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
