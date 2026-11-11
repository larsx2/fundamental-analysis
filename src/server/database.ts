import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-bun";
import { Effect, Layer } from "effect";
import { migrations } from "./migrations";

export const databaseFile = "data/fundamental-analysis.db";

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
