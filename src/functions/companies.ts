import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Option, Schema } from "effect";
import { Collector, collectHomeCompanies } from "../server/collector";
import { Companies, type CompanyState } from "../server/companies";
import { askedFor, knownCompanies, latestFiscalYear } from "../server/company-view";
import { companyNamedIn } from "../server/named-company";
import { runtime } from "../server/runtime";
import {
  contactOf,
  contactText,
  Settings,
  secContactKey,
  secContactText,
} from "../server/settings";
import { statementsFor } from "../server/terms/terms";
import { summarise } from "../shared/company-summary";
import { valueOf } from "../shared/figures";
import { homeCompanies } from "../shared/home-companies";

export type { CompanySummary } from "../shared/company-summary";
export type { NamedCompany } from "../server/named-company";

export type ListedCompany = {
  readonly cik: number;
  readonly name: string;
  readonly ticker: string;
  readonly state: Exclude<CompanyState, "not_collected">;
  readonly asOf: string | null;
  readonly lastCheckedOn: string | null;
  readonly failureReason: string | null;
  readonly collectStep: number | null;
  readonly latestFiscalYear: number | null;
};

const getCompanies = createServerFn({ method: "GET" }).handler(() =>
  runtime.runPromise(
    Effect.gen(function* () {
      const settings = yield* Settings;
      const rows = yield* askedFor;
      const listed: Array<ListedCompany> = [];
      for (const row of rows) {
        if (row.state === "not_collected" || row.ticker === null) continue;
        listed.push({
          cik: row.cik,
          name: row.name,
          ticker: row.ticker,
          state: row.state,
          asOf: row.asOf,
          lastCheckedOn: row.lastCheckedOn,
          failureReason: row.failureReason,
          collectStep: row.collectStep,
          latestFiscalYear: row.state === "ready" ? yield* latestFiscalYear(row.cik) : null,
        });
      }
      return {
        known: yield* knownCompanies,
        contact: Option.match(secContactText(yield* settings.get(secContactKey)), {
          onNone: () => null,
          onSome: contactOf,
        }),
        companies: listed,
      };
    }),
  ),
);

export const companiesQuery = queryOptions({
  queryKey: ["companies"],
  queryFn: () => getCompanies(),
});

const Ciks = Schema.Struct({ ciks: Schema.Array(Schema.Int) });

const getSummaries = createServerFn({ method: "GET" })
  .validator(Schema.decodeUnknownSync(Ciks))
  .handler(({ data }) =>
    runtime.runPromise(
      Effect.forEach(data.ciks, (cik) =>
        statementsFor(cik).pipe(Effect.map((years) => ({ cik, summary: summarise(years) }))),
      ),
    ),
  );

// Apart from the list of companies, which is asked for every second while one
// is collected, and keyed by the ready companies so a newly ready one is fetched.
export const summariesQuery = (ciks: ReadonlyArray<number>) =>
  queryOptions({
    queryKey: ["companies", "summaries", [...ciks].sort((a, b) => a - b).join(",")],
    queryFn: () => getSummaries({ data: { ciks: [...ciks] } }),
  });

const getRevenueHistory = createServerFn({ method: "GET" }).handler(() => {
  runtime.runFork(collectHomeCompanies);
  return runtime.runPromise(
    Effect.gen(function* () {
      const rows = yield* askedFor;
      const ready = homeCompanies.flatMap((cik) =>
        rows.filter((row) => row.cik === cik && row.state === "ready"),
      );
      return yield* Effect.forEach(ready, (row) =>
        statementsFor(row.cik).pipe(
          Effect.map((years) => ({
            cik: row.cik,
            name: row.name,
            ticker: row.ticker ?? "",
            points: years.flatMap((year) => {
              const value = valueOf(year.terms.revenue);
              return value === null ? [] : [{ fiscalYear: year.fiscalYear, value }];
            }),
          })),
        ),
      );
    }),
  );
});

export type RevenueHistory = Awaited<ReturnType<typeof getRevenueHistory>>[number];

export const revenueHistoryQuery = queryOptions({
  queryKey: ["companies", "revenue-history"],
  queryFn: () => getRevenueHistory(),
  staleTime: 60_000,
});

export type CompanyMatch = {
  readonly cik: number;
  readonly name: string;
  readonly tickers: ReadonlyArray<string>;
  readonly state: CompanyState;
};

const findCompanies = createServerFn({ method: "GET" })
  .validator(Schema.decodeUnknownSync(Schema.Struct({ query: Schema.String })))
  .handler(({ data }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const companies = yield* Companies;
        const matches = yield* companies.search(data.query, 20);
        return matches.map((match): CompanyMatch => ({
          cik: match.cik,
          name: match.name,
          tickers: [...match.tickers],
          state: match.state,
        }));
      }),
    ),
  );

export const searchQuery = (query: string) =>
  queryOptions({
    queryKey: ["companies", "search", query.trim().toLowerCase()],
    queryFn: () => findCompanies({ data: { query } }),
    staleTime: 2_000,
  });

const Contact = Schema.Struct({ name: Schema.String, email: Schema.String });

export const saveContact = createServerFn({ method: "POST" })
  .validator(Schema.decodeUnknownSync(Contact))
  .handler(({ data }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const settings = yield* Settings;
        yield* settings.set(secContactKey, contactText(data));
      }),
    ),
  );

export const fetchCompanyList = createServerFn({ method: "POST" }).handler(() =>
  runtime.runPromise(
    Effect.gen(function* () {
      const companies = yield* Companies;
      return yield* companies.refreshList.pipe(
        Effect.tap(() => collectHomeCompanies),
        Effect.map((count) => ({ ok: true as const, count })),
        Effect.catch((error) => Effect.succeed({ ok: false as const, reason: error.message })),
      );
    }),
  ),
);

export type CollectAnswer =
  | { readonly answer: "waiting" | "already ready" }
  | { readonly answer: "not covered"; readonly reason: string }
  | { readonly answer: "could not ask"; readonly reason: string };

export const collectCompany = createServerFn({ method: "POST" })
  .validator(Schema.decodeUnknownSync(Schema.Struct({ cik: Schema.Int })))
  .handler(({ data }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const collector = yield* Collector;
        return yield* collector.request(data.cik).pipe(
          Effect.map((answer): CollectAnswer => answer),
          Effect.catch((error) =>
            Effect.succeed<CollectAnswer>({
              answer: "could not ask",
              reason: error.message,
            }),
          ),
        );
      }),
    ),
  );

export const removeCompany = createServerFn({ method: "POST" })
  .validator(Schema.decodeUnknownSync(Schema.Struct({ cik: Schema.Int })))
  .handler(({ data }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const collector = yield* Collector;
        yield* collector.remove(data.cik);
      }),
    ),
  );

export const findCompanyIn = createServerFn({ method: "GET" })
  .validator(
    Schema.decodeUnknownSync(
      Schema.Struct({ text: Schema.String, skip: Schema.Array(Schema.String) }),
    ),
  )
  .handler(({ data }) => runtime.runPromise(companyNamedIn(data.text, data.skip)));
