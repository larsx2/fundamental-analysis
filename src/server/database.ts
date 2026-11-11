import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-bun";
import { Effect, Layer } from "effect";
import { migrations } from "./migrations";

/** Where each person's collected data lives. The folder is ignored by git. */
export const databaseFile = "data/fundamental-analysis.db";

// A Layer is a recipe for building services that other code asks for.
// Code that needs the database only says "I need a SqlClient". Which file
// it opens, or whether it is a throwaway database in memory for a test,
// is decided once, by whichever layer is provided when the program runs.
//
// `Layer.unwrap` builds the layer from an Effect, so the folder is made
// only when the layer is actually used, not when this file is imported.
const client = (filename: string) =>
  Layer.unwrap(
    Effect.sync(() => {
      if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
      return SqliteClient.layer({ filename });
    }),
  );

// Changes to the database's structure, applied in order, each one once.
// The migrator records which ones have run in a table of its own.
const migrator = SqliteMigrator.layer({
  loader: SqliteMigrator.fromRecord(migrations),
});

/**
 * The database, opened and brought up to date.
 *
 * `provideMerge` hands the client to the migrator, so the changes run on
 * the same file, and keeps the client available to the rest of the program.
 */
export const databaseLayer = (filename: string = databaseFile) =>
  migrator.pipe(Layer.provideMerge(client(filename)));
