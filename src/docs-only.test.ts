import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "@effect/vitest";
import { docs, isDoc } from "../scripts/docs-only";

describe("docs that skip the full checks", () => {
  it("are only the listed files", () => {
    expect(isDoc("docs/adr/0012-a-decision.md")).toBe(true);
    expect(isDoc("README.md")).toBe(true);
    expect(isDoc("GLOSSARY.md")).toBe(false);
    expect(isDoc("docs/adr/nested/x.md")).toBe(false);
    expect(isDoc("src/README.md")).toBe(false);
    expect(isDoc("docs/rfc/x.mdx")).toBe(false);
  });

  it("are never mentioned by code, which would mean code reads them", () => {
    const mentions = docs.map((doc) => doc.split("*")[0] ?? doc);
    const own = new Set(["scripts/docs-only.ts", "src/docs-only.test.ts"]);
    const readers = ["src", "scripts", "screens", "evals"]
      .flatMap((folder) =>
        readdirSync(folder, { recursive: true, encoding: "utf8" }).map(
          (file) => `${folder}/${file.replaceAll("\\", "/")}`,
        ),
      )
      .filter((file) => /\.[cm]?[jt]sx?$/.test(file) && !own.has(file))
      .filter((file) => {
        const text = readFileSync(file, "utf8");
        return mentions.some((mention) => text.includes(mention));
      });
    expect(readers).toEqual([]);
  });
});
