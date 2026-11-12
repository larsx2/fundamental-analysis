import { describe, expect, it } from "@effect/vitest";
import { Context, Effect, Layer, Option, Schedule } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import { Collect } from "./collect";
import { Collector } from "./collector";
import type { CompanyState } from "./companies";
import { Logos } from "./logos";
import { CoverageCheck } from "./coverage";
import { databaseLayer } from "./database";

const apple = 1;
const microsoft = 2;
const costco = 3;
const jpmorgan = 4;

type Event = `${"start" | "end"} ${number}`;

const services = (events: Array<Event>, failFirstTry: ReadonlySet<number> = new Set()) => {
  const tried = new Set<number>();
  const collect = Layer.effect(
    Collect,
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      return Collect.of({
        filings: () => Effect.succeed(0),
        businessDescription: () => Effect.void,
        reportedNumbers: (cik) =>
          Effect.gen(function* () {
            events.push(`start ${cik}`);
            yield* Effect.sleep("20 millis");
            if (failFirstTry.has(cik) && !tried.has(cik)) {
              tried.add(cik);
              events.push(`end ${cik}`);
              return yield* Effect.die(new Error("The SEC could not be reached."));
            }
            yield* sql`
              INSERT INTO filing (accession, cik, form, filed_on)
              VALUES (${`a-${cik}`}, ${cik}, '10-K', '2025-10-31')
            `;
            yield* sql`
              INSERT INTO reported_number
                (accession, cik, taxonomy, tag, unit, start_on, end_on, fiscal_year, value)
              VALUES (${`a-${cik}`}, ${cik}, 'us-gaap', 'Revenues', 'USD', '2024-09-29', '2025-09-27', 2025, 1)
            `;
            events.push(`end ${cik}`);
            return { filings: 1, numbers: 1, unexpected: [] };
          }),
      });
    }),
  );
  const coverage = Layer.succeed(
    CoverageCheck,
    CoverageCheck.of({
      check: (cik) =>
        Effect.succeed(
          cik === jpmorgan
            ? { covered: false, reason: "JPMorgan is a bank or lender." }
            : { covered: true },
        ),
    }),
  );
  const logos = Layer.succeed(
    Logos,
    Logos.of({
      fetch: () => Effect.void,
      logo: () => Effect.succeedNone,
      missing: Effect.succeed([]),
    }),
  );
  return Layer.mergeAll(collect, coverage, logos).pipe(
    Layer.provideMerge(databaseLayer(":memory:")),
  );
};

const seed = (companies: ReadonlyArray<[number, CompanyState?]>) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    for (const [cik, state = "not_collected"] of companies) {
      yield* sql`
        INSERT INTO company (cik, name, list_position, state, requested_at)
        VALUES (${cik}, ${`Company ${cik}`}, ${cik}, ${state}, ${cik})
      `;
    }
  });

const startCollector = Effect.gen(function* () {
  return Context.get(yield* Layer.build(Collector.layer), Collector);
});

const waitUntil = (
  collector: Collector["Service"],
  cik: number,
  states: ReadonlyArray<CompanyState>,
) =>
  collector.status(cik).pipe(
    Effect.map(Option.getOrThrow),
    Effect.repeat({
      schedule: Schedule.spaced("5 millis"),
      until: (company) => states.includes(company.state),
      times: 400,
    }),
  );

describe("Collector", () => {
  it.live(
    "companies asked for together are collected one after another, in the order asked",
    () => {
      const events: Array<Event> = [];
      return Effect.gen(function* () {
        yield* seed([[apple], [microsoft], [costco]]);
        const collector = yield* startCollector;
        for (const cik of [apple, microsoft, costco]) yield* collector.request(cik);
        yield* waitUntil(collector, costco, ["ready"]);
        expect(events).toEqual([
          `start ${apple}`,
          `end ${apple}`,
          `start ${microsoft}`,
          `end ${microsoft}`,
          `start ${costco}`,
          `end ${costco}`,
        ]);
      }).pipe(Effect.provide(services(events)));
    },
  );

  it.live("a ready company has its as of and last checked dates", () =>
    Effect.gen(function* () {
      yield* seed([[apple]]);
      const collector = yield* startCollector;
      yield* collector.request(apple);
      const company = yield* waitUntil(collector, apple, ["ready"]);
      expect(company.asOf).toBe("2025-10-31");
      expect(company.lastCheckedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }).pipe(Effect.provide(services([]))),
  );

  it.live("a failed company keeps its reason and is collected when asked again", () =>
    Effect.gen(function* () {
      yield* seed([[apple]]);
      const collector = yield* startCollector;
      yield* collector.request(apple);
      const failed = yield* waitUntil(collector, apple, ["failed"]);
      expect(failed.failureReason).toBe("The SEC could not be reached.");

      yield* collector.request(apple);
      const ready = yield* waitUntil(collector, apple, ["ready"]);
      expect(ready.failureReason).toBeNull();
    }).pipe(Effect.provide(services([], new Set([apple])))),
  );

  it.live("a company left waiting or collecting is collected when the tool starts again", () =>
    Effect.gen(function* () {
      yield* seed([[apple, "collecting"], [microsoft, "waiting"], [costco]]);
      const collector = yield* startCollector;
      yield* waitUntil(collector, microsoft, ["ready"]);
      const states = yield* Effect.forEach([apple, microsoft, costco], (cik) =>
        collector.status(cik).pipe(Effect.map((company) => Option.getOrThrow(company).state)),
      );
      expect(states).toEqual(["ready", "ready", "not_collected"]);
    }).pipe(Effect.provide(services([]))),
  );

  it.live("removing a company deletes its collected data and returns it to not collected", () =>
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      yield* seed([[apple]]);
      const collector = yield* startCollector;
      yield* collector.request(apple);
      yield* waitUntil(collector, apple, ["ready"]);

      yield* collector.remove(apple);
      const company = Option.getOrThrow(yield* collector.status(apple));
      const left = yield* sql<{ n: number }>`
        SELECT (SELECT count(*) FROM reported_number WHERE cik = ${apple})
             + (SELECT count(*) FROM filing WHERE cik = ${apple}) AS n
      `;
      expect([company.state, company.asOf, left[0]?.n]).toEqual(["not_collected", null, 0]);
    }).pipe(Effect.provide(services([]))),
  );

  it.live(
    "a company that is not covered is answered with the reason and nothing is collected",
    () => {
      const events: Array<Event> = [];
      return Effect.gen(function* () {
        yield* seed([[jpmorgan]]);
        const collector = yield* startCollector;
        const answer = yield* collector.request(jpmorgan);
        expect(answer).toEqual({
          answer: "not covered",
          reason: "JPMorgan is a bank or lender.",
        });
        expect(Option.getOrThrow(yield* collector.status(jpmorgan)).state).toBe("not_collected");
        expect(events).toEqual([]);
      }).pipe(Effect.provide(services(events)));
    },
  );
});
