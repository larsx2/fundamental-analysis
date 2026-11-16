import { Config } from "effect";

// A flag lets a replacement for something that already works be built on
// `main` while the old version stays in use. Every flag is listed here and read
// only in runtime.ts, where the tool picks which version of a part to plug in.
// A flag is deleted, with the version it switched off, by its remove-by date.
export type Flag = {
  readonly purpose: string;
  // The values the environment variable accepts. The first is the default, and
  // stays the old version until the new one becomes the default.
  readonly values: readonly [string, string, ...Array<string>];
  // Dates in UTC, written as year, month and day, such as "2026-12-31". The
  // remove-by date is at most 45 days after the date the flag was added.
  readonly added: string;
  readonly removeBy: string;
};

// For example:
// FLAG_AGENT: {
//   purpose: "Answers questions with the AI SDK instead of Codex.",
//   values: ["codex", "ai-sdk"],
//   added: "2026-11-16",
//   removeBy: "2026-12-31",
// },
export const flags = {} as const satisfies Readonly<Record<`FLAG_${string}`, Flag>>;

export type FlagName = keyof typeof flags;
export type FlagValue<Name extends FlagName> = (typeof flags)[Name] extends Flag
  ? (typeof flags)[Name]["values"][number]
  : never;

const listed: Readonly<Record<string, Flag | undefined>> = flags;

// A flag's value, from the environment variable of the same name, such as
// FLAG_AGENT=ai-sdk. Unset, it is the default; a value not listed is an error.
export const flag = <Name extends FlagName>(name: Name): Config.Config<FlagValue<Name>> => {
  const { values } = listed[name] as Flag;
  return Config.Literals(values, name).pipe(Config.withDefault(values[0])) as Config.Config<
    FlagValue<Name>
  >;
};
