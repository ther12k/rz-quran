import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Same-origin API in development (docs/03 §3): the browser never talks
      // to the API cross-origin.
      "/api": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:3310",
        changeOrigin: false,
      },
    },
  },
  build: {
    sourcemap: false,
  },
});
