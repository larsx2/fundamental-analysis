import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Option, Schema } from "effect";
import { Collector } from "../server/collector";
import { Companies } from "../server/companies";
import { askedFor, knownCompanies, latestFiscalYear } from "../server/company-view";
import { runtime } from "../server/runtime";
import { Settings, secContactKey } from "../server/settings";
import { statementsFor } from "../server/terms/terms";
import { summarise } from "../shared/company-summary";

export type { CompanySummary } from "../shared/company-summary";

const contactOf = (text: string | null) => {
  if (text === null) return null;
  const words = text.trim().split(/\s+/);
  const email = words.at(-1) ?? "";
  return email.includes("@")
    ? { name: words.slice(0, -1).join(" "), email }
    : { name: text.trim(), email: "" };
};

export type ListedCompany = {
  readonly cik: number;
  readonly name: string;
  readonly ticker: string;
  readonly state: "waiting" | "collecting" | "ready" | "failed";
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
        contact: contactOf(Option.getOrNull(yield* settings.get(secContactKey))),
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

export type CompanyMatch = {
  readonly cik: number;
  readonly name: string;
  readonly tickers: ReadonlyArray<string>;
  readonly state: "not_collected" | "waiting" | "collecting" | "ready" | "failed";
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
        yield* settings.set(secContactKey, `${data.name.trim()} ${data.email.trim()}`);
      }),
    ),
  );

export const fetchCompanyList = createServerFn({ method: "POST" }).handler(() =>
  runtime.runPromise(
    Effect.gen(function* () {
      const companies = yield* Companies;
      return yield* companies.refreshList.pipe(
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

// Words that start questions or name ideas rather than companies.
const notNames = new Set(
  "what whats where when which who why how does did do is are was were the a an of in on to for and or its it their money go goes going grow growing grew growth spend spent spends kept keep keeps cash debt year years fiscal much many make makes made earn earns earned buy buys sell sells pay pays paid balance sheet statement statements timeline overview happen happened happening show me tell about".split(
    " ",
  ),
);

export type NamedCompany = {
  readonly cik: number;
  readonly name: string;
  readonly ticker: string;
  readonly state: CompanyMatch["state"];
};

// The company a sentence names, by ticker or by the start of its name.
export const findCompanyIn = createServerFn({ method: "GET" })
  .validator(
    Schema.decodeUnknownSync(
      Schema.Struct({ text: Schema.String, skip: Schema.Array(Schema.String) }),
    ),
  )
  .handler(({ data }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const companies = yield* Companies;
        const skip = new Set(data.skip.map((word) => word.toLowerCase()));
        const tokens = data.text.match(/[A-Za-z][A-Za-z.&-]*/g) ?? [];
        const named = (match: CompanyMatch | undefined, ticker: string): NamedCompany | null =>
          match === undefined
            ? null
            : { cik: match.cik, name: match.name, ticker, state: match.state };

        for (const token of tokens.filter((each) => /^[A-Z]{1,5}$/.test(each) && each !== "I")) {
          const matches = yield* companies.search(token, 3);
          const exact = matches.find((match) => match.tickers.includes(token));
          if (exact !== undefined) return named(exact, token);
        }
        const words = tokens
          .map((token) => token.replace(/'s$/i, "").replace(/[.-]+$/, ""))
          .filter(
            (word) =>
              word.length >= 3 &&
              !notNames.has(word.toLowerCase()) &&
              !skip.has(word.toLowerCase()),
          )
          .sort((a, b) => Number(/^[A-Z]/.test(b)) - Number(/^[A-Z]/.test(a)));
        for (const word of words) {
          const matches = yield* companies.search(word, 3);
          // An everyday word typed in lower case names only a company already
          // collected, so "hello" does not offer to collect Hello Group.
          const first = matches.find(
            (match) =>
              match.name.toLowerCase().startsWith(word.toLowerCase()) &&
              (/^[A-Z]/.test(word) || match.state === "ready"),
          );
          if (first !== undefined) return named(first, first.tickers[0] ?? word.toUpperCase());
        }
        return null;
      }),
    ),
  );
