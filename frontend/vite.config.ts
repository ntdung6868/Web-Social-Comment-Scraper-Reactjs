import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
      "@components": resolve(__dirname, "./src/components"),
      "@pages": resolve(__dirname, "./src/pages"),
      "@hooks": resolve(__dirname, "./src/hooks"),
      "@services": resolve(__dirname, "./src/services"),
      "@stores": resolve(__dirname, "./src/stores"),
      "@types": resolve(__dirname, "./src/types"),
      "@utils": resolve(__dirname, "./src/utils"),
      "@layouts": resolve(__dirname, "./src/layouts"),
    },
  },
  build: {
    // Split vendor packages into named chunks. Routes are already lazy
    // (src/routes.tsx) so only the chunks needed for the current route
    // load on first paint. Vendor chunks stay cached across app deploys
    // because their hash only changes when the dep itself changes —
    // shipping app code no longer invalidates ~250KB of MUI.
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "mui-vendor": [
            "@mui/material",
            "@mui/icons-material",
            "@emotion/react",
            "@emotion/styled",
          ],
          "query-vendor": ["@tanstack/react-query", "@tanstack/react-query-devtools", "axios"],
          "form-vendor": ["react-hook-form", "@hookform/resolvers", "zod"],
          "i18n-vendor": ["i18next", "react-i18next"],
          "date-vendor": ["date-fns"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
      "/socket.io": {
        target: "http://localhost:5000",
        ws: true,
      },
    },
  },
});
