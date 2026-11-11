import { Context, Effect, Layer, Option, Schema } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";
import * as SqlSchema from "effect/sql/SqlSchema";

// The schema tool describes the shape of a piece of data once. The same
// description checks rows as they come back from the database, so a row
// in an unexpected shape fails loudly instead of flowing on as bad data.
/** The contact details the SEC asks every program that reads its data to send. */
export const secContactKey = "sec-contact";

const SettingRow = Schema.Struct({
  key: Schema.String,
  value: Schema.String,
});

/**
 * Small local settings kept in the database, such as the contact details
 * the SEC asks for. They live with the collected data, so they are never
 * committed.
 */
// A service is a named piece of the program that others ask for by name.
// This class is both the name (used with `yield* Settings`) and the
// description of what the service offers.
export class Settings extends Context.Service<
  Settings,
  {
    readonly get: (
      key: string,
    ) => Effect.Effect<Option.Option<string>, SqlError | Schema.SchemaError>;
    readonly set: (
      key: string,
      value: string,
    ) => Effect.Effect<void, SqlError | Schema.SchemaError>;
  }
>()("Settings") {
  static readonly layer = Layer.effect(
    Settings,
    Effect.gen(function* () {
      const sql = yield* SqlClient;

      const findOne = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: SettingRow,
        execute: (key) => sql`SELECT key, value FROM setting WHERE key = ${key}`,
      });

      const upsert = SqlSchema.void({
        Request: SettingRow,
        execute: (row) => sql`
          INSERT INTO setting (key, value) VALUES (${row.key}, ${row.value})
          ON CONFLICT (key) DO UPDATE SET value = excluded.value
        `,
      });

      return Settings.of({
        get: (key) => findOne(key).pipe(Effect.map(Option.map((row) => row.value))),
        set: (key, value) => upsert({ key, value }),
      });
    }),
  );
}
