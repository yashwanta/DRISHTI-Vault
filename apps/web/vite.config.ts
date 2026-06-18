import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Localhost only. Dev server proxies /api to the FastAPI backend on 7788.
export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:7788",
    },
  },
  preview: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
