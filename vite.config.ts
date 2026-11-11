import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  server: {
    // The tool runs on this machine only, so the server never listens beyond it.
    host: "127.0.0.1",
    port: 4100,
    strictPort: true,
  },
  plugins: [
    // TanStack Start must come before React.
    tanstackStart(),
    viteReact(),
  ],
  fmt: {
    ignorePatterns: ["src/routeTree.gen.ts"],
  },
  lint: {
    ignorePatterns: ["src/routeTree.gen.ts"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    passWithNoTests: true,
  },
});
