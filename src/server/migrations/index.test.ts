import { readdirSync } from "node:fs";
import { describe, expect, it } from "@effect/vitest";
import { migrations } from "./index";

describe("migrations", () => {
  it("lists every migration file in the folder, in number order", () => {
    const files = readdirSync(new URL(".", import.meta.url))
      .filter((file) => /^\d{4}_.+\.ts$/.test(file) && !file.endsWith(".test.ts"))
      .map((file) => file.replace(/\.ts$/, ""))
      .sort();
    expect(Object.keys(migrations)).toEqual(files);
  });
});
