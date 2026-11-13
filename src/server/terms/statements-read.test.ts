import { readFileSync } from "node:fs";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Collect } from "../collect";
import { databaseLayer } from "../database";
import { ReportedNumbers } from "../reported-numbers";
import { Sec } from "../sec";
import { chooseStatements } from "./statements";
import { statementsFor } from "./terms";

const companies = { apple: 320193, microsoft: 789019, costco: 909832 } as const;

describe("statements read only the tags they use", () => {
  for (const [company, cik] of Object.entries(companies)) {
    it.effect(`${company}'s statements match those built from every tag`, () =>
      Effect.gen(function* () {
        yield* (yield* Collect).reportedNumbers(cik);
        const reported = yield* ReportedNumbers;
        const everyTag = chooseStatements({
          durations: yield* reported.yearlyDollarAmounts(cik),
          instants: yield* reported.balances(cik),
          perShare: yield* reported.yearlyPerShareAmounts(cik),
        });
        expect(everyTag.length).toBeGreaterThan(0);
        expect(yield* statementsFor(cik)).toEqual(everyTag);
      }).pipe(
        Effect.provide(
          Collect.layer.pipe(
            Layer.provideMerge(ReportedNumbers.layer),
            Layer.provideMerge(databaseLayer(":memory:")),
            Layer.provide(
              Layer.succeed(
                Sec,
                Sec.of({
                  getJson: () =>
                    Effect.succeed(
                      JSON.parse(
                        readFileSync(
                          new URL(`../testdata/${company}.json`, import.meta.url),
                          "utf8",
                        ),
                      ),
                    ),
                  getText: () => Effect.die("unused"),
                }),
              ),
            ),
          ),
        ),
      ),
    );
  }
});
