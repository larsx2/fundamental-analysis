import { recommended } from "@effect/tsgo/oxlint-presets";
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
    ...recommended,
    ignorePatterns: ["src/routeTree.gen.ts"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    // Effect's own rules, such as an Effect that is written but never run.
    // They only load when the check is started through `effect-tsgo`.
    rules: {
      ...recommended.rules,
      // The database, web request and command line modules are all labelled
      // unstable. Exact versions are fixed instead, as the stack decision says.
      "effecttsgo/unstable-api-usage": "off",
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    passWithNoTests: true,
  },
});
