import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "/sistem/" : "/",
  server: {
    proxy: {
      "/sistem/api": {
        target: "http://localhost:3010",
        rewrite: (path) => path.replace(/^\/sistem/, ""),
      },
    },
  },
}));
