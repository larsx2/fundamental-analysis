import { readdirSync } from "node:fs";
import { SqliteClient } from "@effect/sql-sqlite-bun";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import { migrations } from "./index";

describe("migrations", () => {
  it("lists every migration file in the folder, in number order", () => {
    const files = readdirSync(new URL(".", import.meta.url))
      .filter((file) => /^\d{4}_.+\.ts$/.test(file) && !file.endsWith(".test.ts"))
      .map((file) => file.replace(/\.ts$/, ""))
      .sort();
    expect(Object.keys(migrations)).toEqual(files);
  });

  it.effect("renames the stored years of a company whose year ends near 1 January", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const { "0008_fiscal_year_by_end_less_a_week": rename, ...earlier } = migrations;
      for (const migration of Object.values(earlier)) yield* migration;
      yield* sql`INSERT INTO company (cik, name, list_position) VALUES (1, 'Made Up Foods', 1)`;
      yield* sql`INSERT INTO filing (accession, cik, form, filed_on) VALUES ('a', 1, '10-K', '2023-02-20')`;
      for (const [start, end] of [
        ["2021-01-03", "2022-01-01"],
        ["2022-01-02", "2022-12-31"],
      ]) {
        yield* sql`
          INSERT INTO reported_number (accession, cik, taxonomy, tag, unit, start_on, end_on, fiscal_year, value)
          VALUES ('a', 1, 'us-gaap', 'Revenues', 'USD', ${start}, ${end}, 2022, 1)
        `;
      }

      yield* rename;

      const stored = yield* sql<{ end_on: string; fiscal_year: number }>`
        SELECT end_on, fiscal_year FROM reported_number ORDER BY end_on
      `;
      expect(stored).toEqual([
        { end_on: "2022-01-01", fiscal_year: 2021 },
        { end_on: "2022-12-31", fiscal_year: 2022 },
      ]);
    }).pipe(Effect.provide(SqliteClient.layer({ filename: ":memory:" }))),
  );
});
