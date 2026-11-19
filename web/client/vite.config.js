import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: { rollupOptions: { output: { manualChunks: { charts: ['recharts'] } } } },
  server: { host: "127.0.0.1", port: 5173, strictPort: true, proxy: { "/api": "http://127.0.0.1:5000" } },
  test: {
    environment: "jsdom",
    include: ["client/src/**/*.test.{js,jsx}"],
    setupFiles: [
      fileURLToPath(new URL("./src/test-setup.js", import.meta.url)),
    ],
  },
});
