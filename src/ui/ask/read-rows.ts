import { isReportLookup } from "../../shared/answer-figures";
import type { FilingLink } from "../../shared/lookups";
import type { CompanyScreen } from "../palette";
import type { LookupRead } from "./use-ask";

export const screenFor: Record<string, { readonly path: CompanyScreen; readonly name: string }> = {
  company: { path: "overview", name: "The Overview" },
  trend: { path: "overview", name: "The Overview" },
  dollar: { path: "where-the-money-goes", name: "Where the money goes" },
  cash: { path: "statements", name: "The Statements" },
  balance: { path: "statements", name: "The Statements" },
  returns: { path: "statements", name: "The Statements" },
  marks: { path: "statements", name: "The Statements" },
  uses_of_cash: { path: "timeline", name: "The Timeline" },
  context: { path: "timeline", name: "The Timeline" },
};

export type Opens =
  | { readonly kind: "filing"; readonly url: string }
  | { readonly kind: "screen"; readonly ticker: string; readonly path: CompanyScreen }
  | { readonly kind: "glossary" };

export type ReadRow = {
  readonly key: string;
  readonly ids: ReadonlyArray<string>;
  readonly status: LookupRead["status"];
  readonly title: string;
  readonly lines: ReadonlyArray<string>;
  readonly opens: Opens | null;
};

const names: Record<string, string> = {
  company: "The company",
  trend: "Figures across fiscal years",
  dollar: "Where each dollar went",
  cash: "Net income and free cash flow",
  balance: "The balance sheet",
  uses_of_cash: "Capital allocation",
  returns: "Operating income, debt and equity",
  context: "The economy and corporate events",
  marks: "Marks on every figure",
  glossary: "The glossary",
  search_report: "The annual report",
  read_report: "The annual report",
  risk_headings: "The annual report",
};

const tickerOf = (input: unknown) =>
  typeof input === "object" && input !== null && "ticker" in input
    ? String(input.ticker).toUpperCase()
    : "";

const count = (many: number, one: string, more: string) => `${many} ${many === 1 ? one : more}`;

const statusOf = (reads: ReadonlyArray<LookupRead>): LookupRead["status"] =>
  reads.some((read) => read.status === "reading")
    ? "reading"
    : reads.every((read) => read.status === "failed")
      ? "failed"
      : "read";

const reportLines = (reads: ReadonlyArray<LookupRead>, status: LookupRead["status"]) => {
  if (status === "failed") return [reads.at(-1)?.error ?? "Nothing came back"];
  const done = reads.filter((read) => read.result !== null);
  const searches = done.filter((read) => read.lookup === "search_report");
  const found = new Set(searches.flatMap((read) => Object.keys(read.result?.figures ?? {}))).size;
  const lines: Array<string> = [];
  if (searches.length > 0) {
    const where = searches.length === 1 ? "" : ` in ${searches.length} searches`;
    lines.push(
      found === 0
        ? `Nothing found${where}`
        : `${count(found, "paragraph", "paragraphs")} found${where}`,
    );
  }
  for (const read of done) {
    const detail = read.result?.detail;
    if (read.lookup !== "search_report" && detail !== undefined && !lines.includes(detail)) {
      lines.push(detail);
    }
  }
  return lines.length === 0 ? ["Reading"] : lines;
};

export const readRows = (lookups: ReadonlyArray<LookupRead>): ReadonlyArray<ReadRow> => {
  const groups = new Map<string, Array<LookupRead>>();
  for (const read of lookups) {
    const key = isReportLookup(read.lookup) ? `report:${tickerOf(read.input)}` : read.id;
    groups.set(key, [...(groups.get(key) ?? []), read]);
  }
  return [...groups].map(([key, reads]) => {
    const status = statusOf(reads);
    const named = reads.find((read) => read.result !== null) ?? reads[0];
    const title = named?.result?.title ?? names[named?.lookup ?? ""] ?? named?.lookup ?? "";
    const only = reads[0];
    const report = key.startsWith("report:");
    const filing = reads.findLast((read) => read.result?.filings[0] !== undefined)?.result
      ?.filings[0];
    const screen = screenFor[only?.lookup ?? ""];
    const ticker = tickerOf(only?.input);
    const opens: Opens | null =
      status !== "read"
        ? null
        : report
          ? filing === undefined
            ? null
            : { kind: "filing", url: filing.url }
          : only?.lookup === "glossary"
            ? { kind: "glossary" }
            : screen !== undefined && ticker !== ""
              ? { kind: "screen", ticker, path: screen.path }
              : null;
    return {
      key,
      ids: reads.map((read) => read.id),
      status,
      title,
      opens,
      lines:
        report || only === undefined
          ? reportLines(reads, status)
          : [
              status === "reading"
                ? "Reading"
                : status === "failed"
                  ? (only.error ?? "Nothing came back")
                  : (only.result?.detail ?? ""),
            ],
    };
  });
};

const folder = (url: string) => url.slice(0, url.lastIndexOf("/") + 1);

export const filingRows = (lookups: ReadonlyArray<LookupRead>): ReadonlyArray<FilingLink> => {
  const kept = new Map<string, FilingLink>();
  for (const filing of lookups.flatMap((read) => read.result?.filings ?? [])) {
    const before = kept.get(folder(filing.url));
    if (before === undefined || filing.url.length > before.url.length) {
      kept.set(folder(filing.url), filing);
    }
  }
  return [...kept.values()].sort((a, b) => b.filedOn.localeCompare(a.filedOn));
};

export const searchWords = (query: string) =>
  query
    .replace(/\bsection:/gi, "")
    .replace(/\bNEAR\(([^,)]*)(?:,\s*\d+)?\)/g, "$1")
    .replace(/\b(AND|OR|NOT)\b/g, (word) => word.toLowerCase())
    .replace(/["*()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
