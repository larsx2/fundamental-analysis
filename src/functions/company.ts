import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Schema } from "effect";
import type { CompanyState } from "../server/companies";
import { companyDetails, findCompany } from "../server/company-view";
import { Economy, fredPage, fredSeries } from "../server/economy";
import type { CorporateEvent } from "../server/filings";
import { runtime } from "../server/runtime";
import type { StatementYear } from "../server/terms/statements";

export type { CorporateEvent, StatementYear };

export type CompanyView = {
  readonly cik: number;
  readonly name: string;
  readonly ticker: string;
  readonly state: CompanyState;
  readonly asOf: string | null;
  readonly lastCheckedOn: string | null;
  readonly failureReason: string | null;
  readonly notCoveredReason: string | null;
  readonly collectStep: number | null;
  readonly details: {
    readonly years: ReadonlyArray<StatementYear>;
    readonly events: ReadonlyArray<CorporateEvent>;
    readonly eventsFrom: string | null;
    readonly description: {
      readonly text: string;
      readonly accession: string;
      readonly document: string | null;
      readonly filedOn: string;
    } | null;
  } | null;
};

const getCompany = createServerFn({ method: "GET" })
  .validator(Schema.decodeUnknownSync(Schema.Struct({ ticker: Schema.String })))
  .handler(({ data }) =>
    runtime.runPromise(
      Effect.gen(function* () {
        const row = yield* findCompany(data.ticker);
        if (row === null) return null;
        const view: CompanyView = {
          cik: row.cik,
          name: row.name,
          ticker: row.ticker ?? data.ticker.toUpperCase(),
          state: row.state,
          asOf: row.asOf,
          lastCheckedOn: row.lastCheckedOn,
          failureReason: row.failureReason,
          notCoveredReason: row.notCoveredReason,
          collectStep: row.collectStep,
          details: row.state === "ready" ? yield* companyDetails(row) : null,
        };
        return view;
      }),
    ),
  );

export const companyQuery = (ticker: string) =>
  queryOptions({
    queryKey: ["company", ticker.toUpperCase()],
    queryFn: () => getCompany({ data: { ticker } }),
    staleTime: 60_000,
  });

const getEconomy = createServerFn({ method: "GET" }).handler(() =>
  runtime.runPromise(
    Effect.gen(function* () {
      const economy = yield* Economy;
      const { months, fetchedOn } = yield* economy.months;
      return {
        months,
        fetchedOn,
        sources: {
          interestRate: fredPage(fredSeries.interestRate),
          inflation: fredPage(fredSeries.prices),
          recession: fredPage(fredSeries.recession),
        },
      };
    }),
  ),
);

export const economyQuery = queryOptions({
  queryKey: ["economy"],
  queryFn: () => getEconomy(),
  staleTime: 60 * 60_000,
});
