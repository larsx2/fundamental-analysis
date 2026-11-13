import { describe, expect, it } from "@effect/vitest";
import { Effect, Fiber, Layer } from "effect";
import * as HttpClient from "effect/http/HttpClient";
import { SqlClient } from "effect/sql/SqlClient";
import { TestClock } from "effect/testing";
import { databaseLayer } from "./database";
import { Economy, economyMonths, parseFredCsv } from "./economy";
import { Settings } from "./settings";

// FRED's files, trimmed: consumer prices in June 2021 and June 2022, when US
// inflation peaked at about 9%, and an empty month, as FRED writes October
// 2025, when no prices were published.
const prices = `observation_date,CPIAUCSL
2021-06-01,271.696
2021-07-01,
2022-06-01,296.311
2022-07-01,297.0
`;
const rates = `observation_date,FEDFUNDS
2022-06-01,1.21
2022-07-01,1.68
`;
const recessions = `observation_date,USREC
2022-06-01,0
2022-07-01,0
`;

describe("economic context from the US central bank's data", () => {
  it("counts inflation against prices twelve months before, and leaves a missing month as a gap", () => {
    const months = economyMonths({
      interestRate: parseFredCsv(rates),
      prices: parseFredCsv(prices),
      recession: parseFredCsv(recessions),
    });
    expect(months.map((month) => [month.month, month.inflation])).toEqual([
      ["2022-06", 9.1],
      ["2022-07", null],
    ]);
  });
});

const silentFred = (asked: { count: number }) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make(() =>
      Effect.suspend(() => {
        asked.count++;
        return Effect.never;
      }),
    ),
  );

const unreachable = (asked: { count: number }) =>
  Economy.layer.pipe(
    Layer.provideMerge(Settings.layer),
    Layer.provideMerge(databaseLayer(":memory:")),
    Layer.provideMerge(silentFred(asked)),
  );

const keepAMonth = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`
    INSERT INTO economy_month (month, interest_rate, inflation, recession)
    VALUES ('2022-06', 1.21, 9.1, 0)
  `;
});

describe("economic context when the US central bank does not answer", () => {
  it.effect("a load right after a failed attempt answers at once from the stored months", () => {
    const asked = { count: 0 };
    return Effect.gen(function* () {
      yield* keepAMonth;
      const economy = yield* Economy;

      const first = yield* Effect.forkChild(economy.months);
      yield* TestClock.adjust("21 seconds");
      yield* Fiber.await(first);

      const second = yield* Effect.forkChild(economy.months);
      const { months, fetchedOn } = yield* Fiber.join(second);

      expect(months.map((month) => month.month)).toEqual(["2022-06"]);
      expect(fetchedOn).toBeNull();
      expect(asked.count).toBe(1);
    }).pipe(Effect.provide(unreachable(asked)));
  });

  it.effect("loads at the same moment share one attempt", () => {
    const asked = { count: 0 };
    return Effect.gen(function* () {
      yield* keepAMonth;
      const economy = yield* Economy;

      const loads = yield* Effect.forkChild(
        Effect.all([economy.months, economy.months, economy.months], {
          concurrency: "unbounded",
        }),
      );
      yield* TestClock.adjust("21 seconds");
      yield* Fiber.join(loads);

      expect(asked.count).toBe(1);
    }).pipe(Effect.provide(unreachable(asked)));
  });
});
