import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "@effect/vitest";
import { type Flag, flags } from "./flags";

const listed: ReadonlyArray<readonly [string, Flag]> = Object.entries(flags);

const day = (date: string) => new Date(`${date}T00:00:00Z`);
const isDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && day(date).toISOString().startsWith(date);

describe("flags", () => {
  it("are removed by their remove-by date", () => {
    const today = new Date().toISOString().slice(0, 10);
    const overdue = listed
      .filter(([, flag]) => flag.removeBy < today)
      .map(([name, flag]) => `${name} (remove by ${flag.removeBy})`);
    expect(
      overdue,
      "Overdue flags. If your change does not touch them, stop and tell the owner: never move a date or delete a flag inside another change.",
    ).toEqual([]);
  });

  it("live at most 45 days, with real dates", () => {
    for (const [name, flag] of listed) {
      expect(isDate(flag.added), `${name} added`).toBe(true);
      expect(isDate(flag.removeBy), `${name} removeBy`).toBe(true);
      const days = (day(flag.removeBy).getTime() - day(flag.added).getTime()) / 86_400_000;
      expect(days, name).toBeGreaterThanOrEqual(0);
      expect(days, name).toBeLessThanOrEqual(45);
    }
  });

  it("are few, each with a purpose and different values", () => {
    expect(listed.length, "Finish a flag before starting another.").toBeLessThanOrEqual(3);
    for (const [name, flag] of listed) {
      expect(flag.purpose.trim(), name).not.toBe("");
      expect(new Set(flag.values).size, name).toBe(flag.values.length);
    }
  });

  it("are read only in runtime.ts, where parts are plugged in", () => {
    const allowed = new Set([
      "src/server/runtime.ts",
      "src/server/flags.ts",
      "src/server/flags.test.ts",
      "scripts/pre-push.ts",
    ]);
    const readsFlags = (text: string) =>
      /["'][^"']*\/flags(\.[cm]?[jt]s)?["']/.test(text) || /\bFLAG_[A-Z0-9_]+/.test(text);
    const readers = ["src", "scripts", "screens", "evals"]
      .flatMap((folder) =>
        readdirSync(folder, { recursive: true, encoding: "utf8" }).map(
          (file) => `${folder}/${file.replaceAll("\\", "/")}`,
        ),
      )
      .filter((file) => /\.[cm]?[jt]sx?$/.test(file) && !allowed.has(file))
      .filter((file) => readsFlags(readFileSync(file, "utf8")));
    expect(readers).toEqual([]);
  });

  it("are not passed on by runtime.ts, which exports only the runtime", () => {
    const exported = readFileSync("src/server/runtime.ts", "utf8").match(
      /\bexport\b(?!\s+const\s+runtime\b)/g,
    );
    expect(exported ?? []).toEqual([]);
  });
});
