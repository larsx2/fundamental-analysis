import { beforeAll, describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import { heldOut, tuning } from "../../evals/questions";
import { homeCompanies } from "../shared/home-companies";
import { Collect } from "./collect";
import { Companies } from "./companies";
import { databaseLayer } from "./database";
import { ReportedNumbers } from "./reported-numbers";
import {
  fillStarter,
  readSavedAnswers,
  type SavedAnswers,
  savedSec,
  starterCompanies,
} from "./starter";

let answers: SavedAnswers;
beforeAll(async () => {
  answers = await readSavedAnswers();
});

const built = <A, E>(check: Effect.Effect<A, E, SqlClient>) =>
  Effect.gen(function* () {
    yield* fillStarter(answers.savedOn);
    return yield* check;
  }).pipe(
    Effect.provide(
      Layer.mergeAll(Collect.layer, Companies.layer).pipe(
        Layer.provideMerge(ReportedNumbers.layer),
        Layer.provide(savedSec(answers)),
        Layer.provideMerge(databaseLayer(":memory:")),
      ),
    ),
  );

describe("the starter database", () => {
  it("holds the home page companies", () => {
    expect(starterCompanies).toEqual(expect.arrayContaining([...homeCompanies]));
  });

  it.effect(
    "holds every company the evals ask about, ready, with its latest annual report read",
    () =>
      built(
        Effect.gen(function* () {
          const sql = yield* SqlClient;
          return yield* sql<{
            ticker: string;
            state: string;
            paragraphs: number;
          }>`
            SELECT t.ticker, c.state,
              (SELECT count(*) FROM report_paragraph p WHERE p.cik = c.cik) AS paragraphs
            FROM company c JOIN company_ticker t ON t.cik = c.cik
            WHERE c.cik IN ${sql.in(starterCompanies)}
          `;
        }),
      ).pipe(
        Effect.map((rows) => {
          for (const { ticker } of [...tuning, ...heldOut]) {
            const row = rows.find((candidate) => candidate.ticker === ticker);
            expect(row, ticker).toMatchObject({ state: "ready" });
            expect(row?.paragraphs, ticker).toBeGreaterThan(0);
          }
        }),
      ),
    30_000,
  );
});
