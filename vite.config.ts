import { recommended } from "@effect/tsgo/oxlint-presets";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  server: {
    host: "127.0.0.1",
    port: 4100,
    strictPort: true,
  },
  plugins: [
    // TanStack Start must come before React.
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
  fmt: {
    ignorePatterns: ["src/routeTree.gen.ts", "src/server/testdata/**"],
  },
  lint: {
    ...recommended,
    plugins: [...(recommended.plugins ?? []), "typescript", "react"],
    ignorePatterns: ["src/routeTree.gen.ts"],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    // The Effect rules load only when the check runs through `effect-tsgo`.
    rules: {
      ...recommended.rules,
      // Unstable Effect modules are used on purpose, with exact versions fixed.
      "effecttsgo/unstable-api-usage": "off",
      "react/rules-of-hooks": "error",
      "react/exhaustive-deps": "error",
      "typescript/no-floating-promises": "error",
      "typescript/no-explicit-any": "error",
      // These three belong to the React Compiler, which this project does not use.
      "react/refs": "off",
      "react/set-state-in-effect": "off",
      "react/immutability": "off",
    },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    passWithNoTests: true,
  },
});
