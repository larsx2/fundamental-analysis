import { Effect, Schema } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import * as SqlSchema from "effect/sql/SqlSchema";
import { Sec } from "./sec";

export const submissionsUrl = (cik: number) =>
  `https://data.sec.gov/submissions/CIK${String(cik).padStart(10, "0")}.json`;

const olderSubmissionsUrl = (name: string) => `https://data.sec.gov/submissions/${name}`;

const FilingColumns = Schema.Struct({
  accessionNumber: Schema.Array(Schema.String),
  filingDate: Schema.Array(Schema.String),
  reportDate: Schema.Array(Schema.String),
  form: Schema.Array(Schema.String),
  items: Schema.Array(Schema.String),
  primaryDocument: Schema.Array(Schema.String),
});

const Submissions = Schema.Struct({
  filings: Schema.Struct({
    recent: FilingColumns,
    files: Schema.Array(Schema.Struct({ name: Schema.String })),
  }),
});

// Only the forms a screen uses are kept: annual reports for their business
// description, and current reports for corporate events.
const keptForms = new Set(["10-K", "10-K/A", "10-KT", "8-K", "8-K/A"]);

export type CompanyFiling = {
  readonly accession: string;
  readonly form: string;
  readonly filedOn: string;
  readonly reportDate: string | null;
  readonly items: string;
  readonly primaryDocument: string | null;
};

const rowsOf = (columns: typeof FilingColumns.Type): ReadonlyArray<CompanyFiling> =>
  columns.form.flatMap((form, index) =>
    keptForms.has(form)
      ? [
          {
            accession: columns.accessionNumber[index] ?? "",
            form,
            filedOn: columns.filingDate[index] ?? "",
            reportDate: columns.reportDate[index] || null,
            items: columns.items[index] ?? "",
            primaryDocument: columns.primaryDocument[index] || null,
          },
        ]
      : [],
  );

const earliest = (columns: typeof FilingColumns.Type) => [...columns.filingDate].sort()[0] ?? null;

// The SEC's record of a company lists its most recent thousand filings, and
// points to older pages for the rest. All of them are read, so the timeline
// reaches back as far as the reported numbers do.
export const collectFilings = (cik: number) =>
  Effect.gen(function* () {
    const sec = yield* Sec;
    const sql = yield* SqlClient;
    const decode = Schema.decodeUnknownEffect(Submissions);
    const decodeOlder = Schema.decodeUnknownEffect(FilingColumns);

    const recent = yield* decode(yield* sec.getJson(submissionsUrl(cik)));
    const pages = [recent.filings.recent];
    for (const file of recent.filings.files) {
      pages.push(yield* decodeOlder(yield* sec.getJson(olderSubmissionsUrl(file.name))));
    }
    const filings = pages.flatMap(rowsOf);
    const from = pages
      .map(earliest)
      .filter((date) => date !== null)
      .sort()[0];

    yield* sql.withTransaction(
      Effect.gen(function* () {
        yield* sql`DELETE FROM company_filing WHERE cik = ${cik}`;
        for (const filing of filings) {
          yield* sql`
            INSERT INTO company_filing
              (accession, cik, form, filed_on, report_date, items, primary_document)
            VALUES (
              ${filing.accession}, ${cik}, ${filing.form}, ${filing.filedOn},
              ${filing.reportDate}, ${filing.items}, ${filing.primaryDocument}
            )
            ON CONFLICT (accession) DO NOTHING
          `;
        }
        yield* sql`UPDATE company SET filings_from = ${from ?? null} WHERE cik = ${cik}`;
      }),
    );
    return filings.length;
  });

const StoredFiling = Schema.Struct({
  accession: Schema.String,
  form: Schema.String,
  filedOn: Schema.String,
  reportDate: Schema.NullOr(Schema.String),
  items: Schema.String,
  primaryDocument: Schema.NullOr(Schema.String),
});

export const storedFilings = (cik: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    return yield* SqlSchema.findAll({
      Request: Schema.Int,
      Result: StoredFiling,
      execute: (id) => sql`
        SELECT
          accession, form, filed_on AS "filedOn", report_date AS "reportDate", items,
          primary_document AS "primaryDocument"
        FROM company_filing WHERE cik = ${id}
        ORDER BY filed_on
      `,
    })(cik);
  });

export type CorporateEvent = {
  readonly kind: "officers" | "business";
  readonly form: string;
  readonly filedOn: string;
  readonly reportDate: string | null;
  readonly accession: string;
  readonly document: string | null;
  readonly amendedOn: string | null;
};

// Two kinds of corporate event, the ones the SEC's own item numbers name
// without guessing: item 5.02, a director or officer arriving or leaving, and
// item 2.01, a completed acquisition or sale of a business. An amendment is
// folded into the report it amends.
export const corporateEvents = (
  filings: ReadonlyArray<CompanyFiling>,
): ReadonlyArray<CorporateEvent> => {
  const kindsOf = (items: string) => {
    const list = items.split(",").map((item) => item.trim());
    return [
      ...(list.includes("2.01") ? (["business"] as const) : []),
      ...(list.includes("5.02") ? (["officers"] as const) : []),
    ];
  };
  const events: Array<CorporateEvent & { amendedOn: string | null }> = [];
  const sorted = [...filings].sort((a, b) => a.filedOn.localeCompare(b.filedOn));
  for (const filing of sorted) {
    if (filing.form !== "8-K") continue;
    for (const kind of kindsOf(filing.items)) {
      events.push({
        kind,
        form: filing.form,
        filedOn: filing.filedOn,
        reportDate: filing.reportDate,
        accession: filing.accession,
        document: filing.primaryDocument,
        amendedOn: null,
      });
    }
  }
  for (const filing of sorted) {
    if (filing.form !== "8-K/A") continue;
    for (const kind of kindsOf(filing.items)) {
      const original = events
        .filter(
          (event) =>
            event.kind === kind &&
            event.filedOn <= filing.filedOn &&
            (filing.reportDate === null || event.reportDate === filing.reportDate),
        )
        .at(-1);
      if (original !== undefined) original.amendedOn = filing.filedOn;
    }
  }
  return events;
};
