import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// NOTE: This config is used by Vite's dev server and build process.
// It is also bundled into the server CJS bundle (esbuild) for the dev-mode
// middleware. To avoid import.meta issues in CJS, we use process.cwd() as
// the base — which always resolves correctly relative to the project root.
const projectRoot = process.cwd();

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "client", "src"),
      "@shared": path.resolve(projectRoot, "shared"),
      "@assets": path.resolve(projectRoot, "attached_assets"),
    },
  },
  root: path.resolve(projectRoot, "client"),
  base: "./",
  build: {
    outDir: path.resolve(projectRoot, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
