import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-bun";
import { Effect, Layer } from "effect";
import { migrations } from "./migrations";

// The screenshot tests point the tool at a database of their own.
export const databaseFile = process.env.DATABASE_FILE ?? "data/fundamental-analysis.db";

const client = (filename: string) =>
  Layer.unwrap(
    Effect.sync(() => {
      if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
      return SqliteClient.layer({ filename });
    }),
  );

const migrator = SqliteMigrator.layer({
  loader: SqliteMigrator.fromRecord(migrations),
});

export const databaseLayer = (filename: string = databaseFile) =>
  migrator.pipe(Layer.provideMerge(client(filename)));
