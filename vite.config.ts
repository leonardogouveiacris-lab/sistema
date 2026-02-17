import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync, readdirSync } from 'fs';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-pdf-worker',
      buildStart() {
        const pdfjsBase = resolve(__dirname, 'node_modules/react-pdf/node_modules/pdfjs-dist');
        const workerSrc = resolve(pdfjsBase, 'build/pdf.worker.min.mjs');
        const workerDest = resolve(__dirname, 'public/pdf.worker.min.mjs');
        try {
          copyFileSync(workerSrc, workerDest);
          console.log('✓ PDF.js worker file copied successfully');
        } catch (error) {
          console.error('Failed to copy PDF.js worker:', error);
        }

        const wasmSrcDir = resolve(pdfjsBase, 'wasm');
        const wasmDestDir = resolve(__dirname, 'public/wasm');
        try {
          mkdirSync(wasmDestDir, { recursive: true });
          for (const file of readdirSync(wasmSrcDir)) {
            copyFileSync(resolve(wasmSrcDir, file), resolve(wasmDestDir, file));
          }
          console.log('✓ PDF.js WASM files copied successfully');
        } catch (error) {
          console.error('Failed to copy PDF.js WASM files:', error);
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
