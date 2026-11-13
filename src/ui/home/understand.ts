import type { NamedCompany } from "../../functions/companies";
import { allTerms, type GlossaryTerm } from "../../glossary/glossary";
import type { Mention } from "../mention-input";
import type { CompanyScreen } from "../palette";

export type Destination = {
  screen: CompanyScreen;
  label: string;
  tab?: "balance" | "cash";
};

export type Understood =
  | { kind: "term"; term: GlossaryTerm }
  | { kind: "screen"; company: NamedCompany; destination: Destination; year: number | null }
  | { kind: "ask"; company: NamedCompany }
  | { kind: "collect"; company: NamedCompany }
  | { kind: "nothing" };

const byLength = [...allTerms].sort((a, b) => b.name.length - a.name.length);

export const termIn = (text: string) => {
  const lower = text.toLowerCase();
  return (
    byLength.find((term) =>
      new RegExp(
        `(^|[^a-z])${term.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}s?([^a-z]|$)`,
      ).test(lower),
    ) ?? null
  );
};

// Which screen a question is about, from its words and the term it names.
export const screenFor = (text: string, term: GlossaryTerm | null): Destination => {
  const lower = text.toLowerCase();
  if (
    /balance sheet|assets|liabilit|debt|cash flow|statement/.test(lower) ||
    (term !== null && term.section >= 5 && term.section <= 6)
  ) {
    const cash = /cash flow|capital expenditure|free cash/.test(lower) || term?.section === 6;
    const balance = /balance|asset|liabilit|equity|debt|cash\b/.test(lower) || term?.section === 5;
    return {
      screen: "statements",
      label: "the statements",
      ...(cash ? { tab: "cash" } : balance ? { tab: "balance" } : {}),
    };
  }
  if (
    /money go|spend|spent|each dollar|where does|cost|margin|keep|kept/.test(lower) ||
    term?.section === 4
  ) {
    return { screen: "where-the-money-goes", label: "where the money goes" };
  }
  if (
    /happen|timeline|history|event|buyback|dividend|acquisi|interest rate|inflation|recession|do with/.test(
      lower,
    ) ||
    (term !== null && term.section >= 9 && term.section <= 10)
  ) {
    return { screen: "timeline", label: "the timeline" };
  }
  return { screen: "overview", label: "the overview" };
};

export const isQuestion = (text: string) =>
  /\?\s*$|^(is|are|does|do|did|has|have|how|why|where|what|which|when|can|should|could|will)\b/i.test(
    text,
  );

export const yearIn = (text: string) => {
  const match = /\b(20[0-4]\d)\b/.exec(text);
  return match === null ? null : Number(match[1]);
};

export const wordsOf = (trimmed: string) => {
  const term = termIn(trimmed);
  const asksMeaning =
    /^(what('s| is| are| does)|define|meaning of|explain)\b/i.test(trimmed) && term !== null;
  return { term, asksMeaning };
};

export const companyOf = (
  mentioned: Mention | undefined,
  ready: ReadonlyArray<Mention>,
  named: NamedCompany | null | undefined,
  asksMeaning: boolean,
  trimmed: string,
): NamedCompany | null =>
  mentioned !== undefined
    ? {
        ...mentioned,
        state: ready.some((each) => each.cik === mentioned.cik) ? "ready" : "not_collected",
      }
    : asksMeaning || trimmed === ""
      ? null
      : (named ?? null);

export const understand = (reading: {
  trimmed: string;
  term: GlossaryTerm | null;
  asksMeaning: boolean;
  mentioned: boolean;
  company: NamedCompany | null;
  isFetching: boolean;
}): Understood | null => {
  const { trimmed, term, asksMeaning, mentioned, company, isFetching } = reading;
  if (trimmed === "") return null;
  if (term !== null && !mentioned && (company === null || asksMeaning)) {
    return { kind: "term", term };
  }
  if (company !== null && company.state === "ready" && isQuestion(trimmed)) {
    return { kind: "ask", company };
  }
  if (company !== null && company.state === "ready") {
    return {
      kind: "screen",
      company,
      destination: screenFor(trimmed, term),
      year: yearIn(trimmed),
    };
  }
  if (company !== null) return { kind: "collect", company };
  if (isFetching) return null;
  return { kind: "nothing" };
};
