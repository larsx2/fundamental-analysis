import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import { collectInFull } from "./collector";
import { Companies } from "./companies";
import { Logos } from "./logos";
import { Sec, SecNotFound } from "./sec";

// The companies a new database starts with: the five drawn on the home page,
// and the others the evals ask about.
export const starterCompanies: ReadonlyArray<number> = [
  320193, // Apple
  789019, // Microsoft
  909832, // Costco
  1318605, // Tesla
  1045810, // NVIDIA
  1477333, // Cloudflare
  50863, // Intel
  1652044, // Alphabet
  1108524, // Salesforce
];

export const savedAnswersFile = "starter/sec-answers.json.gz";

// Every answer the SEC gave while the starter companies were collected, by address.
export type SavedAnswers = {
  readonly savedOn: string;
  readonly json: Record<string, unknown>;
  readonly text: Record<string, string>;
};

export const readSavedAnswers = async (file = savedAnswersFile): Promise<SavedAnswers> =>
  JSON.parse(new TextDecoder().decode(Bun.gunzipSync(await Bun.file(file).bytes())));

export const writeSavedAnswers = (answers: SavedAnswers, file = savedAnswersFile) =>
  Bun.write(file, Bun.gzipSync(JSON.stringify(answers)));

// Answers only from the saved copy, so nothing reaches the SEC.
export const savedSec = (answers: SavedAnswers) =>
  Layer.succeed(
    Sec,
    Sec.of({
      getJson: (url) =>
        url in answers.json
          ? Effect.succeed(answers.json[url])
          : Effect.fail(new SecNotFound({ url })),
      getText: (url) => {
        const text = answers.text[url];
        return text === undefined ? Effect.fail(new SecNotFound({ url })) : Effect.succeed(text);
      },
    }),
  );

// Asks the SEC, and keeps a copy of every answer in `answers`.
export const recordingSec = (answers: SavedAnswers) =>
  Layer.effect(
    Sec,
    Effect.gen(function* () {
      const sec = yield* Sec;
      return Sec.of({
        getJson: (url) =>
          sec
            .getJson(url)
            .pipe(Effect.tap((answer) => Effect.sync(() => (answers.json[url] = answer)))),
        getText: (url) =>
          sec
            .getText(url)
            .pipe(Effect.tap((answer) => Effect.sync(() => (answers.text[url] = answer)))),
      });
    }),
  );

export class StarterIncomplete extends Error {}

// Logos come from Wikidata, not the SEC, so none are fetched here. The tool
// fetches the missing ones when it starts.
const noLogos = Layer.succeed(
  Logos,
  Logos.of({
    fetch: () => Effect.void,
    logo: () => Effect.succeedNone,
    missing: Effect.succeed([]),
  }),
);

// Fetches the list of companies and collects each starter company with the
// tool's own steps. They are marked as checked with the SEC on `checkedOn`.
export const fillStarter = (checkedOn: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    yield* (yield* Companies).refreshList;
    for (const cik of starterCompanies) {
      yield* collectInFull(cik).pipe(Effect.provide(noLogos));
    }
    yield* sql`
      UPDATE company SET last_checked_on = ${checkedOn} WHERE cik IN ${sql.in(starterCompanies)}
    `;
    // A report that cannot be read leaves a gap rather than failing, so a
    // missing one is caught here.
    const unread = yield* sql<{ name: string }>`
      SELECT name FROM company
      WHERE cik IN ${sql.in(starterCompanies)} AND description_accession IS NULL
    `;
    if (unread.length > 0) {
      return yield* Effect.die(
        new StarterIncomplete(
          `No annual report was read for ${unread.map((row) => row.name).join(", ")}.`,
        ),
      );
    }
  });
