import { Context, Effect, Layer, Option, Schema } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";
import * as SqlSchema from "effect/sql/SqlSchema";

export const secContactKey = "sec-contact";

const SettingRow = Schema.Struct({
  key: Schema.String,
  value: Schema.String,
});

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
