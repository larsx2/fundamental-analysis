import { Effect, Option, Schema } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";
import { CompanyState } from "./companies";
import { corporateEvents, storedFilings } from "./filings";
import { statementsFor } from "./terms/terms";

const CompanyRow = Schema.Struct({
  cik: Schema.Int,
  name: Schema.String,
  ticker: Schema.NullOr(Schema.String),
  state: CompanyState,
  asOf: Schema.NullOr(Schema.String),
  lastCheckedOn: Schema.NullOr(Schema.String),
  failureReason: Schema.NullOr(Schema.String),
  notCoveredReason: Schema.NullOr(Schema.String),
  collectStep: Schema.NullOr(Schema.Int),
  requestedAt: Schema.NullOr(Schema.Finite),
  filingsFrom: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
  descriptionAccession: Schema.NullOr(Schema.String),
});
export type CompanyRow = typeof CompanyRow.Type;

const columns = (sql: SqlClient) => sql`
  c.cik, c.name,
  (SELECT ticker FROM company_ticker t WHERE t.cik = c.cik ORDER BY t.list_position LIMIT 1)
    AS ticker,
  c.state, c.as_of AS "asOf", c.last_checked_on AS "lastCheckedOn",
  c.failure_reason AS "failureReason", c.not_covered_reason AS "notCoveredReason",
  c.collect_step AS "collectStep", c.requested_at AS "requestedAt",
  c.filings_from AS "filingsFrom", c.description,
  c.description_accession AS "descriptionAccession"
`;

export const companyByTicker = (ticker: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    return yield* SqlSchema.findOneOption({
      Request: Schema.String,
      Result: CompanyRow,
      execute: (wanted) => sql`
        SELECT ${columns(sql)} FROM company c
        WHERE c.cik = (SELECT cik FROM company_ticker WHERE ticker = ${wanted})
      `,
    })(ticker.toUpperCase());
  });

// Every company someone has asked for: ready, in line, failed.
export const askedFor = Effect.gen(function* () {
  const sql = yield* SqlClient;
  return yield* SqlSchema.findAll({
    Request: Schema.Void,
    Result: CompanyRow,
    execute: () => sql`
      SELECT ${columns(sql)} FROM company c
      WHERE c.state != 'not_collected'
      ORDER BY c.requested_at, c.name
    `,
  })(undefined);
});

export const knownCompanies = Effect.gen(function* () {
  const sql = yield* SqlClient;
  const rows = yield* sql<{
    count: number;
  }>`SELECT count(*) AS count FROM company`;
  return rows[0]?.count ?? 0;
});

export const latestFiscalYear = (cik: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    const rows = yield* sql<{ year: number | null }>`
      SELECT max(fiscal_year) AS year FROM reported_number
      WHERE cik = ${cik} AND unit = 'USD' AND start_on IS NOT NULL
    `;
    return rows[0]?.year ?? null;
  });

export const companyDetails = (row: CompanyRow) =>
  Effect.gen(function* () {
    const years = yield* statementsFor(row.cik);
    const filings = yield* storedFilings(row.cik);
    const annualReports = filings.filter((filing) => filing.form === "10-K");
    const described = annualReports.find((filing) => filing.accession === row.descriptionAccession);
    return {
      years,
      events: corporateEvents(filings),
      eventsFrom: row.filingsFrom,
      description:
        row.description === null || described === undefined
          ? null
          : {
              text: row.description,
              accession: described.accession,
              document: described.primaryDocument,
              filedOn: described.filedOn,
            },
    };
  });

export const findCompany = (ticker: string) =>
  companyByTicker(ticker).pipe(Effect.map(Option.getOrNull));
