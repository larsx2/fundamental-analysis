import { readFileSync } from "node:fs";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { splitFigures } from "../../shared/answer-figures";
import { Collect } from "../collect";
import { databaseLayer } from "../database";
import { ReportedNumbers } from "../reported-numbers";
import { Sec } from "../sec";
import type { StatementYear } from "../terms/statements";
import { statementsFor } from "../terms/terms";
import { type CompanyData, glossaryLookup, LookupProblem, runLookup } from "./lookups";

const companies = { apple: 320193, costco: 909832 } as const;
type Company = keyof typeof companies;

const extract = (company: Company): unknown =>
  JSON.parse(readFileSync(new URL(`../testdata/${company}.json`, import.meta.url), "utf8"));

const companyData = (company: Company) =>
  Effect.gen(function* () {
    yield* (yield* Collect).reportedNumbers(companies[company]);
    const years = yield* statementsFor(companies[company]);
    return {
      cik: companies[company],
      name: company,
      ticker: company.toUpperCase(),
      years: years.filter((year) => year.fiscalYear <= 2023),
      events: [],
      description: null,
      months: [],
      unexpectedNumbers: 0,
    } satisfies CompanyData;
  }).pipe(
    Effect.provide(
      Collect.layer.pipe(
        Layer.provideMerge(ReportedNumbers.layer),
        Layer.provideMerge(databaseLayer(":memory:")),
        Layer.provide(
          Layer.succeed(
            Sec,
            Sec.of({
              getJson: () => Effect.succeed(extract(company)),
              getText: () => Effect.die("unused"),
            }),
          ),
        ),
      ),
    ),
  );

describe("the agent's lookups, from trimmed SEC data", () => {
  it.effect("tells the agent how many of the SEC.s numbers could not be read", () =>
    Effect.gen(function* () {
      const data = yield* companyData("apple");
      const notes = (unexpectedNumbers: number) =>
        runLookup({ ...data, unexpectedNumbers }, "company", {
          ticker: "AAPL",
        }).notes.filter((note) => note.includes("cannot read"));
      expect(notes(0)).toEqual([]);
      expect(notes(1)).toEqual([
        "One number the SEC holds for apple came in a shape the tool cannot read, so it was left out.",
      ]);
      expect(notes(2)).toEqual([
        "2 numbers the SEC holds for apple came in a shape the tool cannot read, so they were left out.",
      ]);
    }),
  );

  // Apple's annual report for fiscal 2023: revenue $383,285 million, down from $394,328 million.
  it.effect("writes Apple's revenue and its change exactly as the annual report gives them", () =>
    Effect.gen(function* () {
      const data = yield* companyData("apple");
      const { figures } = runLookup(data, "trend", {
        ticker: "AAPL",
        terms: ["Revenue"],
      });
      expect(figures["Revenue, fiscal 2023"]).toBe("$383.3 billion");
      expect(figures["Revenue, change in fiscal 2023"]).toBe("−2.8%");
    }),
  );

  it.effect("keeps a gap a gap rather than writing it as zero", () =>
    Effect.gen(function* () {
      const data = yield* companyData("costco");
      const trend = runLookup(data, "trend", {
        ticker: "COST",
        terms: ["Research and development"],
      });
      expect(trend.figures["Research and development, fiscal 2023"]).toBe("gap");
      const dollar = runLookup(data, "dollar", { ticker: "COST" });
      expect(dollar.figures["Research and development, cents of each dollar of revenue"]).toBe(
        undefined,
      );
      expect(
        dollar.notes.some((note) => note.startsWith("Research and development is a gap")),
      ).toBe(true);
    }),
  );

  it.effect("splits each dollar into cents that add up to one dollar", () =>
    Effect.gen(function* () {
      const data = yield* companyData("costco");
      const { figures } = runLookup(data, "dollar", {
        ticker: "COST",
        fiscalYear: 2023,
      });
      const cents = Object.entries(figures)
        .filter(([name]) => name.endsWith("cents of each dollar of revenue"))
        .map(([, text]) => Number.parseInt(text, 10));
      expect(cents.reduce((total, each) => total + each, 0)).toBe(100);
    }),
  );

  it.effect("answers a term the glossary does not use with the terms it does", () =>
    Effect.gen(function* () {
      const data = yield* companyData("apple");
      expect(() => runLookup(data, "trend", { ticker: "AAPL", terms: ["Sales"] })).toThrow(
        LookupProblem,
      );
    }),
  );
});

describe("the glossary lookup", () => {
  it("finds a term by a name filings use for it, and says what else it is called", () => {
    const result = glossaryLookup(" eps ");
    expect(result.title).toBe("Glossary: Earnings per share");
    expect(result.notes).toContain(
      "Also called: EPS, diluted earnings per share, net income per share (NVIDIA's label)",
    );
    expect(glossaryLookup(" Net income ").title).toBe("Glossary: Net income");
    expect(() => glossaryLookup("net")).toThrow(LookupProblem);
    expect(glossaryLookup("Net sales").title).toBe("Glossary: Revenue");
    expect(glossaryLookup("other income and expense").title).toBe(
      "Glossary: Interest and other income",
    );
  });

  it("never sends a name two terms share to either of them", () => {
    expect(() => glossaryLookup("stock")).toThrow(LookupProblem);
    expect(glossaryLookup("gross margin").title).toBe("Glossary: Gross margin");
    expect(() => glossaryLookup("profit per share")).toThrow(LookupProblem);
  });
});

describe("checking the figures in an answer", () => {
  it("marks a number no lookup gave, and matches a given figure only whole", () => {
    const pieces = splitFigures(
      "Revenue was $303.2 billion in fiscal 2026, a change of +10.1%, after $3.2 billion and 12% before.",
      [
        { text: "$303.2 billion", source: "a" },
        { text: "+10.1%", source: "a" },
        { text: "$3.2 billion", source: "b" },
      ],
    );
    expect(pieces.filter((piece) => piece.kind === "figure").map((piece) => piece.text)).toEqual([
      "$303.2 billion",
      "+10.1%",
      "$3.2 billion",
    ]);
    expect(pieces.filter((piece) => piece.kind === "unchecked").map((piece) => piece.text)).toEqual(
      ["12%"],
    );
  });
});

describe("what a company did with its cash in its latest year", () => {
  const reported = (value: number) =>
    ({
      kind: "reported",
      value,
      latest: { tag: "t", value, accession: "a", filedOn: "2026-01-01" },
      original: { tag: "t", value, accession: "a", filedOn: "2026-01-01" },
      doubtful: null,
    }) as const;
  const withYears = (
    rows: ReadonlyArray<{ dividends?: number; shareBuybacks?: number }>,
  ): CompanyData => ({
    cik: 1,
    name: "Example",
    ticker: "EX",
    years: rows.map((row, index) => ({
      fiscalYear: 2022 + index,
      startOn: `${2022 + index}-01-01`,
      endOn: `${2022 + index}-12-31`,
      terms: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, reported(value)]),
      ) as StatementYear["terms"],
    })),
    events: [],
    description: null,
    months: [],
    unexpectedNumbers: 0,
  });
  const notes = (data: CompanyData) => runLookup(data, "uses_of_cash", { ticker: "EX" }).notes;

  it("says plainly that it paid no dividend when the latest year is zero", () => {
    expect(notes(withYears([{ dividends: 5 }, { dividends: 0 }]))).toContain(
      "In fiscal 2023 it paid no dividend.",
    );
  });

  it("reads a line left out after a year of zero as none, and one left out after a payment as a gap", () => {
    const stopped = notes(
      withYears([{ shareBuybacks: 9, dividends: 4 }, { shareBuybacks: 0, dividends: 4 }, {}, {}]),
    );
    expect(stopped).toContain(
      "In fiscal 2025 it made no share buybacks: the cash flow statement shows $0 in fiscal 2023 and leaves the line out after that, as statements leave out a line that is zero.",
    );
    expect(stopped).toContain(
      "Dividends has no line after fiscal 2023: a gap, not zero. Search the annual report for whether it stopped.",
    );
  });

  it("adds nothing about the latest year while it still pays", () => {
    expect(
      notes(withYears([{ dividends: 4, shareBuybacks: 9 }])).filter((note) =>
        /fiscal 2022 it|no line after/.test(note),
      ),
    ).toEqual([]);
  });
});
