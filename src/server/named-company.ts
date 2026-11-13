import { Effect } from "effect";
import { Companies, type CompanyMatch, type CompanyState } from "./companies";

export type NamedCompany = {
  readonly cik: number;
  readonly name: string;
  readonly ticker: string;
  readonly state: CompanyState;
};

// Words that start questions or name ideas rather than companies.
const notNames = new Set(
  "what whats where when which who why how does did do is are was were the a an of in on to for and or its it their money go goes going grow growing grew growth spend spent spends kept keep keeps cash debt year years fiscal much many make makes made earn earns earned buy buys sell sells pay pays paid balance sheet statement statements timeline overview happen happened happening show me tell about has have had will would can could should may might must compare give explain list".split(
    " ",
  ),
);

const notTickers = new Set(["I", "A"]);

export const companyNamedIn = (text: string, skip: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const companies = yield* Companies;
    const skipped = new Set(skip.map((word) => word.toLowerCase()));
    const tokens = text.match(/[A-Za-z][A-Za-z.&-]*/g) ?? [];
    const found: Array<NamedCompany> = [];
    const named = (match: CompanyMatch, ticker: string): NamedCompany => ({
      cik: match.cik,
      name: match.name,
      ticker,
      state: match.state,
    });

    for (const token of tokens.filter(
      (each) => /^[A-Z]{1,5}$/.test(each) && !notTickers.has(each),
    )) {
      const matches = yield* companies.search(token, 3);
      const exact = matches.find((match) => match.tickers.includes(token));
      if (exact !== undefined) found.push(named(exact, token));
    }
    const words = tokens
      .map((token) => token.replace(/[.-]+$/, ""))
      .filter(
        (word) =>
          word.length >= 3 && !notNames.has(word.toLowerCase()) && !skipped.has(word.toLowerCase()),
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
      if (first !== undefined) found.push(named(first, first.tickers[0] ?? word.toUpperCase()));
    }
    return found.find((company) => company.state === "ready") ?? found[0] ?? null;
  });
