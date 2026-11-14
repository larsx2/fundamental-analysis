import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["evals/**/*.eval.ts"],
    testTimeout: 240_000,
    maxConcurrency: 3,
    sequence: { concurrent: true },
  },
});
