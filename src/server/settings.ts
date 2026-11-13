import { Context, Effect, Layer, Option, Schema } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";
import * as SqlSchema from "effect/sql/SqlSchema";

export const secContactKey = "sec-contact";

export type Contact = {
  readonly name: string;
  readonly email: string;
};

export const contactText = ({ name, email }: Contact) => `${name} ${email}`;

// Settings keep the contact as one line, the way the SEC wants it in a header.
export const contactOf = (text: string): Contact => {
  const words = text.trim().split(/\s+/);
  const email = words.at(-1) ?? "";
  return email.includes("@")
    ? { name: words.slice(0, -1).join(" "), email }
    : { name: text.trim(), email: "" };
};

type ContactEnv = {
  readonly [name: string]: string | undefined;
};

// The contact can be given once in the environment, so a machine that runs
// the tool without anyone at the dialog still works. When the dialog has a
// contact, that one wins, so changing it there still works.
export const contactFromEnv = (env: ContactEnv = process.env): Option.Option<Contact> => {
  const name = env.SEC_CONTACT_NAME?.trim() ?? "";
  const email = env.SEC_CONTACT_EMAIL?.trim() ?? "";
  if (name === "" && email === "") return Option.none();
  if (name === "" || email === "")
    throw new Error("Set both SEC_CONTACT_NAME and SEC_CONTACT_EMAIL, or neither.");
  return Option.some({ name, email });
};

export const secContactText = (
  stored: Option.Option<string>,
  env: ContactEnv = process.env,
): Option.Option<string> =>
  Option.orElse(stored, () => Option.map(contactFromEnv(env), contactText));

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
