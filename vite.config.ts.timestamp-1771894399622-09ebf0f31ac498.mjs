// vite.config.ts
import { defineConfig } from "file:///home/project/node_modules/vite/dist/node/index.js";
import react from "file:///home/project/node_modules/@vitejs/plugin-react/dist/index.mjs";
import { copyFileSync, mkdirSync, readdirSync } from "fs";
import { resolve } from "path";
var __vite_injected_original_dirname = "/home/project";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    {
      name: "copy-pdf-worker",
      buildStart() {
        const pdfjsBase = resolve(__vite_injected_original_dirname, "node_modules/react-pdf/node_modules/pdfjs-dist");
        const workerSrc = resolve(pdfjsBase, "build/pdf.worker.min.mjs");
        const workerDest = resolve(__vite_injected_original_dirname, "public/pdf.worker.min.mjs");
        try {
          copyFileSync(workerSrc, workerDest);
          console.log("\u2713 PDF.js worker file copied successfully");
        } catch (error) {
          console.error("Failed to copy PDF.js worker:", error);
        }
        const wasmSrcDir = resolve(pdfjsBase, "wasm");
        const wasmDestDir = resolve(__vite_injected_original_dirname, "public/wasm");
        try {
          mkdirSync(wasmDestDir, { recursive: true });
          for (const file of readdirSync(wasmSrcDir)) {
            copyFileSync(resolve(wasmSrcDir, file), resolve(wasmDestDir, file));
          }
          console.log("\u2713 PDF.js WASM files copied successfully");
        } catch (error) {
          console.error("Failed to copy PDF.js WASM files:", error);
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ["lucide-react"]
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9wcm9qZWN0XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9wcm9qZWN0L3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3Byb2plY3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XG5pbXBvcnQgeyBjb3B5RmlsZVN5bmMsIG1rZGlyU3luYywgcmVhZGRpclN5bmMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICB7XG4gICAgICBuYW1lOiAnY29weS1wZGYtd29ya2VyJyxcbiAgICAgIGJ1aWxkU3RhcnQoKSB7XG4gICAgICAgIGNvbnN0IHBkZmpzQmFzZSA9IHJlc29sdmUoX19kaXJuYW1lLCAnbm9kZV9tb2R1bGVzL3JlYWN0LXBkZi9ub2RlX21vZHVsZXMvcGRmanMtZGlzdCcpO1xuICAgICAgICBjb25zdCB3b3JrZXJTcmMgPSByZXNvbHZlKHBkZmpzQmFzZSwgJ2J1aWxkL3BkZi53b3JrZXIubWluLm1qcycpO1xuICAgICAgICBjb25zdCB3b3JrZXJEZXN0ID0gcmVzb2x2ZShfX2Rpcm5hbWUsICdwdWJsaWMvcGRmLndvcmtlci5taW4ubWpzJyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY29weUZpbGVTeW5jKHdvcmtlclNyYywgd29ya2VyRGVzdCk7XG4gICAgICAgICAgY29uc29sZS5sb2coJ1x1MjcxMyBQREYuanMgd29ya2VyIGZpbGUgY29waWVkIHN1Y2Nlc3NmdWxseScpO1xuICAgICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0ZhaWxlZCB0byBjb3B5IFBERi5qcyB3b3JrZXI6JywgZXJyb3IpO1xuICAgICAgICB9XG5cbiAgICAgICAgY29uc3Qgd2FzbVNyY0RpciA9IHJlc29sdmUocGRmanNCYXNlLCAnd2FzbScpO1xuICAgICAgICBjb25zdCB3YXNtRGVzdERpciA9IHJlc29sdmUoX19kaXJuYW1lLCAncHVibGljL3dhc20nKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBta2RpclN5bmMod2FzbURlc3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuICAgICAgICAgIGZvciAoY29uc3QgZmlsZSBvZiByZWFkZGlyU3luYyh3YXNtU3JjRGlyKSkge1xuICAgICAgICAgICAgY29weUZpbGVTeW5jKHJlc29sdmUod2FzbVNyY0RpciwgZmlsZSksIHJlc29sdmUod2FzbURlc3REaXIsIGZpbGUpKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgY29uc29sZS5sb2coJ1x1MjcxMyBQREYuanMgV0FTTSBmaWxlcyBjb3BpZWQgc3VjY2Vzc2Z1bGx5Jyk7XG4gICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIGNvcHkgUERGLmpzIFdBU00gZmlsZXM6JywgZXJyb3IpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICBdLFxuICBvcHRpbWl6ZURlcHM6IHtcbiAgICBleGNsdWRlOiBbJ2x1Y2lkZS1yZWFjdCddLFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXlOLFNBQVMsb0JBQW9CO0FBQ3RQLE9BQU8sV0FBVztBQUNsQixTQUFTLGNBQWMsV0FBVyxtQkFBbUI7QUFDckQsU0FBUyxlQUFlO0FBSHhCLElBQU0sbUNBQW1DO0FBTXpDLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOO0FBQUEsTUFDRSxNQUFNO0FBQUEsTUFDTixhQUFhO0FBQ1gsY0FBTSxZQUFZLFFBQVEsa0NBQVcsZ0RBQWdEO0FBQ3JGLGNBQU0sWUFBWSxRQUFRLFdBQVcsMEJBQTBCO0FBQy9ELGNBQU0sYUFBYSxRQUFRLGtDQUFXLDJCQUEyQjtBQUNqRSxZQUFJO0FBQ0YsdUJBQWEsV0FBVyxVQUFVO0FBQ2xDLGtCQUFRLElBQUksK0NBQTBDO0FBQUEsUUFDeEQsU0FBUyxPQUFPO0FBQ2Qsa0JBQVEsTUFBTSxpQ0FBaUMsS0FBSztBQUFBLFFBQ3REO0FBRUEsY0FBTSxhQUFhLFFBQVEsV0FBVyxNQUFNO0FBQzVDLGNBQU0sY0FBYyxRQUFRLGtDQUFXLGFBQWE7QUFDcEQsWUFBSTtBQUNGLG9CQUFVLGFBQWEsRUFBRSxXQUFXLEtBQUssQ0FBQztBQUMxQyxxQkFBVyxRQUFRLFlBQVksVUFBVSxHQUFHO0FBQzFDLHlCQUFhLFFBQVEsWUFBWSxJQUFJLEdBQUcsUUFBUSxhQUFhLElBQUksQ0FBQztBQUFBLFVBQ3BFO0FBQ0Esa0JBQVEsSUFBSSw4Q0FBeUM7QUFBQSxRQUN2RCxTQUFTLE9BQU87QUFDZCxrQkFBUSxNQUFNLHFDQUFxQyxLQUFLO0FBQUEsUUFDMUQ7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLGNBQWM7QUFBQSxJQUNaLFNBQVMsQ0FBQyxjQUFjO0FBQUEsRUFDMUI7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
