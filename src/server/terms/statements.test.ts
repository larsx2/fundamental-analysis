import { readFileSync } from "node:fs";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { Collect } from "../collect";
import { databaseLayer } from "../database";
import { ReportedNumbers } from "../reported-numbers";
import { Sec } from "../sec";
import type { NumberRow } from "./choose-terms";
import { balanceCheck, findSplits } from "./statements";
import { statementsFor } from "./terms";

const realCompanies = { apple: 320193, microsoft: 789019, intel: 50863, cloudflare: 1477333 };

const extract = (company: string): unknown =>
  JSON.parse(readFileSync(new URL(`../testdata/${company}.json`, import.meta.url), "utf8"));

const at = (millions: number, fiscalYear = 2025, report = fiscalYear, accession = 1) => ({
  end: `${fiscalYear}-12-31`,
  val: millions * 1_000_000,
  accn: `0000000001-${report - 1999}-00000${accession}`,
  fy: report,
  fp: "FY",
  form: "10-K",
  filed: `${report + 1}-02-20`,
});
const over = (millions: number, fiscalYear = 2025) => ({
  start: `${fiscalYear}-01-01`,
  ...at(millions, fiscalYear),
});
type Facts = Record<string, ReadonlyArray<ReturnType<typeof at>>>;

const plain = "CashAndCashEquivalentsAtCarryingValue";
const total = "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents";
const totalWithSale =
  "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperations";
const forSale = "DisposalGroupIncludingDiscontinuedOperationCashAndCashEquivalents";

const merge = (
  facts: Record<string, ReturnType<typeof at> | ReadonlyArray<ReturnType<typeof at>>>,
  ...years: ReadonlyArray<Facts>
) => {
  const merged: Record<string, Array<ReturnType<typeof at>>> = {};
  for (const group of [facts, ...years]) {
    for (const [tag, fact] of Object.entries(group)) {
      merged[tag] = [...(merged[tag] ?? []), ...[fact].flat()];
    }
  }
  return merged;
};
const neighbours = (earlier: number, later: number, tag = total): Facts => ({
  [plain]: [at(500, 2024), at(600, 2026)],
  [tag]: [at(earlier, 2024), at(later, 2026)],
});
const equal = (tag = total) => neighbours(500, 600, tag);

const madeUp = {
  otherLines: merge({
    NetCashProvidedByUsedInOperatingActivities: over(600),
    PaymentsToAcquireProductiveAssets: over(300),
    ConvertibleDebtCurrent: at(1_300),
    ConvertibleDebtNoncurrent: at(2_000),
  }),
  cashForSale: merge({
    [totalWithSale]: at(1_000),
    RestrictedCashCurrent: at(30),
    RestrictedCashAndCashEquivalentsNoncurrent: at(20),
    [forSale]: at(100),
  }),
  cashForSaleNotFiled: merge({ [totalWithSale]: at(1_000), RestrictedCashCurrent: at(30) }),
  plainCashAndTotal: merge({ [plain]: at(900), [total]: at(1_000), RestrictedCash: at(50) }),
  restatedTotal: merge(
    { [total]: [at(1_000), at(1_010, 2025, 2026)], RestrictedCashCurrent: at(30) },
    equal(),
  ),
  balanceSheetReport: merge({
    Assets: at(5_000),
    [total]: [at(1_000), at(1_010, 2025, 2026)],
    RestrictedCashCurrent: [at(30), at(40, 2025, 2026)],
  }),
  wholeAndPart: merge({
    [total]: at(1_000),
    RestrictedCashNoncurrent: at(20),
    RestrictedCash: at(50),
  }),
  partsInTwoReports: merge({
    [total]: at(1_000),
    RestrictedCashCurrent: at(30),
    RestrictedCashNoncurrent: at(20, 2025, 2026),
  }),
  restrictedApart: merge({ [total]: at(1_000), RestrictedCash: at(50, 2025, 2025, 2) }, equal()),
  restrictedAboveTotal: merge({ [total]: at(100), RestrictedCash: at(150) }),
  latestOtherReport: merge({
    [total]: at(1_000),
    RestrictedCash: [at(60, 2025, 2025, 2), at(50, 2025, 2026)],
  }),
  zeroRestricted: merge({ [total]: at(1_000), RestrictedCashCurrent: at(0) }),
  zeroBesideNonZero: merge({
    [total]: at(1_000),
    RestrictedCashCurrent: at(0),
    RestrictedCashNoncurrent: at(20),
  }),
  bothZero: merge({ [totalWithSale]: at(1_000), RestrictedCashCurrent: at(0), [forSale]: at(0) }),
  wholeEqualsParts: merge({
    [total]: at(1_000),
    RestrictedCashCurrent: at(30),
    RestrictedCashNoncurrent: at(20),
    RestrictedCash: at(50),
  }),
  olderWholeTag: merge({ [total]: at(1_000), RestrictedCashAndCashEquivalents: at(40) }),
  negativeWhole: merge({ [total]: at(1_000), RestrictedCash: at(-50) }, equal()),
  negativeWholeBesidePart: merge({
    [total]: at(1_000),
    RestrictedCash: at(-50),
    RestrictedCashCurrent: at(30),
  }),
  zeroBesideSale: merge({
    [totalWithSale]: at(1_000),
    RestrictedCashCurrent: at(0),
    [forSale]: at(100),
  }),
  twoLongerTagsInOneReport: merge({
    [total]: at(1_000),
    RestrictedCashNoncurrent: at(20, 2025, 2026),
    RestrictedCashAndCashEquivalentsNoncurrent: at(25, 2025, 2026),
  }),
  bothTotals: merge({
    [total]: at(1_000),
    [totalWithSale]: at(1_100),
    RestrictedCashCurrent: at(30),
  }),
  restatedNeighbour: merge(
    { [total]: [at(1_000), at(510, 2024), at(500, 2024, 2025)] },
    { [plain]: [at(500, 2024), at(600, 2026)], [total]: [at(600, 2026)] },
  ),
  appleFiscal2019: merge({
    [total]: at(50_224),
    RestrictedCashAndCashEquivalentsAtCarryingValue: at(23),
    RestrictedCashAndCashEquivalentsNoncurrent: at(1_357),
  }),
  wholeBelowParts: merge({
    [total]: at(1_000),
    RestrictedCashCurrent: at(30),
    RestrictedCashNoncurrent: at(20),
    RestrictedCash: at(10),
  }),
  twoTagsInOneReport: merge({
    [total]: at(1_000),
    RestrictedCashCurrent: at(30, 2025, 2026),
    RestrictedCashAndCashEquivalentsCurrent: at(35, 2025, 2026),
  }),
  saleBesidePlainTotal: merge({
    [total]: at(1_000),
    RestrictedCashCurrent: at(30),
    [forSale]: at(100),
  }),
  negativeSale: merge({
    [totalWithSale]: at(1_000),
    RestrictedCashCurrent: at(30),
    [forSale]: at(-100),
  }),
  restrictedEqualsTotal: merge({ [total]: at(1_000), RestrictedCash: at(1_000) }),
  negativeRestricted: merge({ [total]: at(1_000), RestrictedCashCurrent: at(-30) }),
  saleZero: merge({ [totalWithSale]: at(1_000), [forSale]: at(0) }, equal(totalWithSale)),
  saleWithNeighbours: merge(
    { [totalWithSale]: at(1_000), [forSale]: at(100) },
    equal(totalWithSale),
  ),
  noSaleFiled: merge({ [totalWithSale]: at(1_000) }, equal(totalWithSale)),
  laterDiffers: merge({ [total]: at(1_000) }, neighbours(500, 610)),
  earlierDiffers: merge({ [total]: at(1_000) }, neighbours(510, 600)),
  noEarlier: merge({ [total]: [at(1_000), at(600, 2026)], [plain]: at(600, 2026) }),
  noLater: merge({ [total]: [at(500, 2024), at(1_000)], [plain]: at(500, 2024) }),
  otherTotalTag: merge({ [total]: at(1_000) }, equal(totalWithSale)),
};
type Company = keyof typeof realCompanies | keyof typeof madeUp;

const madeUpCompany = (cik: number, facts: Facts) => {
  const years = new Set(
    Object.values(facts).flatMap((each) => each.map((fact) => Number(fact.end.slice(0, 4)))),
  );
  return {
    cik,
    entityName: "Made Up Inc.",
    facts: {
      "us-gaap": Object.fromEntries(
        Object.entries({ Revenues: [...years].map((year) => over(2_000, year)), ...facts }).map(
          ([tag, units]) => [tag, { label: tag, units: { USD: units } }],
        ),
      ),
    },
  };
};

const cikOf = (company: Company) =>
  company in realCompanies
    ? realCompanies[company as keyof typeof realCompanies]
    : Object.keys(madeUp).indexOf(company) + 1;

const yearsOf = (company: Company) =>
  Effect.gen(function* () {
    yield* (yield* Collect).reportedNumbers(cikOf(company));
    return yield* statementsFor(cikOf(company));
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
                  company in madeUp
                    ? madeUpCompany(cikOf(company), madeUp[company as keyof typeof madeUp])
                    : extract(company),
                ),
              getText: () => Effect.die("unused"),
            }),
          ),
        ),
      ),
    ),
  );

const statementsOf = (company: Company, fiscalYear: number) =>
  yearsOf(company).pipe(
    Effect.map((years) => years.find((each) => each.fiscalYear === fiscalYear)!.terms),
  );

const millions = (figure: { kind: string; value?: number }) =>
  figure.value === undefined ? figure.kind : Math.round(figure.value / 1_000_000);

describe("the balance sheet and cash flow statement, from trimmed SEC data", () => {
  // Apple's fiscal 2013 earnings per share were filed as $39.75, before its
  // 7-for-1 split in 2014 and its 4-for-1 split in 2020: $1.42 in today's shares.
  it.effect("adjusts old earnings per share for every later share split", () =>
    Effect.gen(function* () {
      const terms = yield* statementsOf("apple", 2013);
      expect(terms.earningsPerShare.kind).toBe("calculated");
      expect(
        Number(terms.earningsPerShare.kind === "gap" ? 0 : terms.earningsPerShare.value.toFixed(2)),
      ).toBe(1.42);
    }),
  );

  it("does not take a restatement that is not a whole multiple for a share split", () => {
    const filed = (value: number, filedOn: string): NumberRow => ({
      tag: "EarningsPerShareDiluted",
      fiscalYear: 2013,
      value,
      accession: filedOn,
      filedOn,
    });
    expect(findSplits([filed(39.75, "2013-10-30"), filed(5.68, "2014-10-27")])).toEqual([
      { ratio: 7, seenOn: "2014-10-27" },
    ]);
    expect(findSplits([filed(39.75, "2013-10-30"), filed(19.3, "2014-10-27")])).toEqual([]);
  });

  // Microsoft restated its fiscal 2016 equity in a later report than its
  // assets and liabilities. Mixing the two filings breaks the sheet's rule.
  it.effect("takes a balance sheet whole from one filing, so it still adds up", () =>
    Effect.gen(function* () {
      const terms = yield* statementsOf("microsoft", 2016);
      expect([millions(terms.assets), millions(terms.liabilities), millions(terms.equity)]).toEqual(
        [193_468, 121_471, 71_997],
      );
      expect(terms.assets.doubtful).not.toBe(balanceCheck);
    }),
  );

  // Apple's annual report for fiscal 2023: commercial paper 5,985, term debt
  // due within a year 9,822 and after it 95,281; operating cash flow 110,543
  // and capital expenditure 10,959, in millions of dollars.
  it.effect("adds debt up from its parts and works out free cash flow", () =>
    Effect.gen(function* () {
      const terms = yield* statementsOf("apple", 2023);
      expect([millions(terms.debt), terms.debt.kind]).toEqual([111_088, "calculated"]);
      expect([millions(terms.freeCashFlow), terms.freeCashFlow.kind]).toEqual([
        99_584,
        "calculated",
      ]);
    }),
  );

  it.effect("takes capital expenditure and debt from the lines some companies use instead", () =>
    Effect.gen(function* () {
      const terms = yield* statementsOf("otherLines", 2025);
      expect(millions(terms.capitalExpenditure)).toBe(300);
      expect(millions(terms.debt)).toBe(3_300);
      expect(millions(terms.freeCashFlow)).toBe(300);
    }),
  );

  it.effect("takes restricted cash and the cash of businesses being sold out of cash", () =>
    Effect.gen(function* () {
      const terms = yield* statementsOf("cashForSale", 2025);
      expect(terms.cash).toMatchObject({
        kind: "calculated",
        value: 850_000_000,
        from: [
          { name: "Cash including restricted cash", value: 1_000_000_000 },
          { name: "Short-term restricted cash", value: -30_000_000 },
          { name: "Longer-term restricted cash", value: -20_000_000 },
          { name: "Cash of businesses being sold", value: -100_000_000 },
        ],
      });
    }),
  );

  const cashOf = (company: Company, fiscalYear = 2025) =>
    statementsOf(company, fiscalYear).pipe(
      Effect.map(({ cash }) => [cash.kind, millions(cash)] as const),
    );

  it.effect("works out cash from the total that includes restricted cash", () =>
    Effect.gen(function* () {
      expect({
        plainCashAndTotal: yield* cashOf("plainCashAndTotal"),
        restatedTotal: yield* cashOf("restatedTotal"),
        balanceSheetReport: yield* cashOf("balanceSheetReport"),
        wholeAndPart: yield* cashOf("wholeAndPart"),
        partsInTwoReports: yield* cashOf("partsInTwoReports"),
        restrictedApart: yield* cashOf("restrictedApart"),
        latestOtherReport: yield* cashOf("latestOtherReport"),
        zeroRestricted: yield* cashOf("zeroRestricted"),
        restrictedEqualsTotal: yield* cashOf("restrictedEqualsTotal"),
        saleWithNeighbours: yield* cashOf("saleWithNeighbours"),
        zeroBesideNonZero: yield* cashOf("zeroBesideNonZero"),
        appleFiscal2019: yield* cashOf("appleFiscal2019"),
        wholeBelowParts: yield* cashOf("wholeBelowParts"),
        twoTagsInOneReport: yield* cashOf("twoTagsInOneReport"),
        saleBesidePlainTotal: yield* cashOf("saleBesidePlainTotal"),
        olderWholeTag: yield* cashOf("olderWholeTag"),
        zeroBesideSale: yield* cashOf("zeroBesideSale"),
        twoLongerTagsInOneReport: yield* cashOf("twoLongerTagsInOneReport"),
        bothTotals: yield* cashOf("bothTotals"),
        restatedNeighbour: yield* cashOf("restatedNeighbour"),
      }).toEqual({
        plainCashAndTotal: ["reported", 900],
        restatedTotal: ["calculated", 980],
        balanceSheetReport: ["calculated", 970],
        wholeAndPart: ["calculated", 950],
        partsInTwoReports: ["calculated", 950],
        restrictedApart: ["calculated", 950],
        latestOtherReport: ["calculated", 950],
        zeroRestricted: ["calculated", 1_000],
        restrictedEqualsTotal: ["calculated", 0],
        saleWithNeighbours: ["calculated", 900],
        zeroBesideNonZero: ["calculated", 980],
        appleFiscal2019: ["calculated", 48_844],
        wholeBelowParts: ["calculated", 950],
        twoTagsInOneReport: ["calculated", 970],
        saleBesidePlainTotal: ["calculated", 970],
        olderWholeTag: ["calculated", 960],
        zeroBesideSale: ["calculated", 900],
        twoLongerTagsInOneReport: ["calculated", 980],
        bothTotals: ["calculated", 970],
        restatedNeighbour: ["calculated", 1_000],
      });
      const equalToParts = yield* statementsOf("wholeEqualsParts", 2025);
      expect(equalToParts.cash.kind === "calculated" && equalToParts.cash.from).toEqual([
        { name: "Cash including restricted cash", value: 1_000_000_000 },
        { name: "Restricted cash", value: -50_000_000 },
      ]);
    }),
  );

  it.effect("leaves cash a gap when the total cannot be trusted as cash", () =>
    Effect.gen(function* () {
      const companies = [
        "cashForSaleNotFiled",
        "noSaleFiled",
        "restrictedAboveTotal",
        "negativeRestricted",
        "negativeSale",
        "negativeWhole",
        "negativeWholeBesidePart",
        "laterDiffers",
        "earlierDiffers",
        "noEarlier",
        "noLater",
        "otherTotalTag",
      ] as const;
      const kinds = yield* Effect.forEach(companies, (company) =>
        statementsOf(company, 2025).pipe(Effect.map(({ cash }) => [company, cash.kind])),
      );
      expect(Object.fromEntries(kinds)).toEqual(
        Object.fromEntries(companies.map((company) => [company, "gap"])),
      );
    }),
  );

  it.effect("says why the total is shown as cash", () =>
    Effect.gen(function* () {
      const how = (company: Company) =>
        statementsOf(company, 2025).pipe(
          Effect.map(({ cash }) => (cash.kind === "calculated" ? (cash.how ?? null) : null)),
        );
      const neighbours =
        "No figure for restricted cash was filed for the end of fiscal 2025. Cash including restricted cash equalled cash at the end of fiscal 2024 ($500 million) and 2026 ($600 million), the nearest years where both were filed, so the $1.00 billion total is shown as cash";
      expect([
        yield* how("restrictedApart"),
        yield* how("zeroBesideNonZero"),
        yield* how("zeroBesideSale"),
        yield* how("zeroRestricted"),
        yield* how("bothZero"),
        yield* how("saleWithNeighbours"),
        yield* how("saleZero"),
      ]).toEqual([
        null,
        null,
        null,
        "Restricted cash was filed as $0 for the end of fiscal 2025, so the total is shown as cash.",
        "Restricted cash and the cash of businesses being sold were filed as $0 for the end of fiscal 2025, so the total is shown as cash.",
        `${neighbours}, less $100 million of cash of businesses being sold.`,
        `${neighbours}.`,
      ]);
      const zero = yield* statementsOf("zeroRestricted", 2025);
      expect(zero.cash.kind === "calculated" && zero.cash.from).toEqual([
        { name: "Cash including restricted cash", value: 1_000_000_000 },
        { name: "Short-term restricted cash", value: 0 },
      ]);
    }),
  );

  it.effect("fills Intel's cash and net debt where it filed cash only with restricted cash", () =>
    Effect.gen(function* () {
      const years = yield* yearsOf("intel");
      expect(
        Object.fromEntries(
          years.map((each) => [each.fiscalYear, [each.terms.cash.kind, millions(each.terms.cash)]]),
        ),
      ).toEqual({
        2016: ["reported", 5_560],
        2017: ["reported", 3_433],
        2018: ["reported", 3_019],
        2019: ["calculated", 4_194],
        2020: ["calculated", 5_865],
        2021: ["calculated", 4_827],
        2022: ["calculated", 11_144],
        2023: ["calculated", 7_079],
        2024: ["reported", 8_249],
        2025: ["reported", 14_265],
      });
      expect(
        years
          .filter((each) => each.fiscalYear >= 2019 && each.fiscalYear <= 2023)
          .map((each) => millions(each.terms.netDebt)),
      ).toEqual([24_809, 30_536, 33_274, 30_863, 42_187]);
      const fiscal2023 = years.find((each) => each.fiscalYear === 2023)!.terms.cash;
      expect(fiscal2023.kind === "calculated" && fiscal2023.how).toBe(
        "No figure for restricted cash was filed for the end of fiscal 2023. Cash including restricted cash equalled cash at the end of fiscal 2018 ($3.02 billion) and 2024 ($8.25 billion), the nearest years where both were filed, so the $7.08 billion total is shown as cash.",
      );
    }),
  );

  it.effect("leaves Cloudflare's 2017 cash a gap, since its restricted cash is not filed", () =>
    Effect.gen(function* () {
      const terms = yield* statementsOf("cloudflare", 2017);
      expect(terms.cash.kind).toBe("gap");
    }),
  );
});
