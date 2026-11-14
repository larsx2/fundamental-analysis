import { Effect } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import type { reportLookups } from "../../shared/answer-figures";
import { filingUrl, longDate } from "../../shared/format";
import type { LookupResult } from "../../shared/lookups";
import { Collect } from "../collect";
import { annualReport, LookupProblem } from "./lookups/common";

export { isReportLookup } from "../../shared/answer-figures";

type Paragraph = { readonly line: number; readonly section: string | null; readonly text: string };

const place = (paragraph: Paragraph) =>
  paragraph.section
    ? `line ${paragraph.line}, under ${paragraph.section}`
    : `line ${paragraph.line}`;

type Report = {
  readonly accession: string;
  readonly filedOn: string;
  readonly document: string | null;
};

const latestReport = (cik: number) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    const stored = () => sql<Report>`
      SELECT f.accession, f.filed_on AS "filedOn", f.primary_document AS document
      FROM company_filing f
      WHERE f.accession = (SELECT accession FROM report_paragraph WHERE cik = ${cik} LIMIT 1)
    `;
    const found = yield* stored();
    if (found[0] !== undefined) return found[0];
    // Companies collected before the tool kept report text get it on first use.
    yield* (yield* Collect).annualReport(cik);
    return (yield* stored())[0] ?? null;
  });

const lineNumber = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;

const result = (
  name: string,
  company: { readonly cik: number; readonly name: string },
  report: Report,
  detail: string,
  paragraphs: ReadonlyArray<Paragraph>,
): LookupResult => ({
  lookup: name,
  title: `${annualReport}, filed on ${longDate(report.filedOn)}`,
  detail,
  figures: Object.fromEntries(paragraphs.map((each) => [place(each), each.text])),
  notes: [
    "Each line is one paragraph of the annual report, after the headings it sits under. Quote the paragraph character for character.",
  ],
  drawing: null,
  filings: [
    {
      form: annualReport,
      filedOn: report.filedOn,
      url: filingUrl(company.cik, report.accession, report.document),
    },
  ],
});

export const reportLookup = (
  company: { readonly cik: number; readonly name: string },
  name: (typeof reportLookups)[number],
  input: Readonly<Record<string, unknown>>,
) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient;
    const report = yield* latestReport(company.cik);
    if (report === null) {
      return yield* new LookupProblem({
        message: `The tool could not read ${company.name}'s latest annual report.`,
      });
    }
    if (name === "search_report") {
      const query = typeof input.query === "string" ? input.query.trim() : "";
      const found = yield* sql<Paragraph>`
        SELECT line, section, text FROM report_paragraph
        WHERE report_paragraph MATCH ${query} AND cik = ${company.cik}
        ORDER BY bm25(report_paragraph) * min(1.0, 0.4 + length(text) / 400.0) LIMIT 8
      `.pipe(
        Effect.mapError(
          () =>
            new LookupProblem({
              message: `The search words "${query}" could not be read. Use words, OR, AND, NOT, "phrases" or prefix*.`,
            }),
        ),
      );
      const detail =
        found.length === 0
          ? `No paragraph matches "${query}"`
          : `${found.length} ${found.length === 1 ? "paragraph matches" : "paragraphs match"} "${query}"`;
      return result(name, company, report, detail, found);
    }
    if (name === "read_report") {
      const from = lineNumber(input.line, 0);
      const count = Math.min(lineNumber(input.count, 1) || 1, 10);
      const found = yield* sql<Paragraph>`
        SELECT line, section, text FROM report_paragraph
        WHERE cik = ${company.cik} AND line >= ${from}
        ORDER BY line LIMIT ${count}
      `;
      return result(name, company, report, `${found.length} paragraphs read`, found);
    }
    const headings = yield* sql<Paragraph>`
      SELECT line, section, text FROM report_paragraph
      WHERE cik = ${company.cik} AND heading = 1
      ORDER BY line
    `;
    return result(name, company, report, `${headings.length} risk headings`, headings);
  });
