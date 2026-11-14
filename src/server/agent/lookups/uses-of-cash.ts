import { valueOf } from "../../../shared/figures";
import type { LookupResult } from "../../../shared/lookups";
import { money } from "../../../shared/format";
import { type CompanyData, recent, last, span, filingsOf } from "./common";

const uses = [
  {
    key: "capitalExpenditure",
    name: "Capital expenditure",
    term: "Capital expenditure",
  },
  { key: "dividends", name: "Dividends", term: "Dividend", none: "paid no dividend" },
  {
    key: "shareBuybacks",
    name: "Share buybacks",
    term: "Share buyback",
    none: "made no share buybacks",
  },
  { key: "acquisitions", name: "Acquisitions", term: "Acquisition" },
  { key: "debtRepaid", name: "Debt repaid", term: "Debt" },
] as const;

const latestYear = (
  name: string,
  none: string,
  values: ReadonlyArray<number | null>,
  years: ReadonlyArray<number>,
) => {
  const latest = last(years);
  if (values.at(-1) === 0) return `In fiscal ${latest} it ${none}.`;
  if (values.at(-1) !== null) return null;
  const at = values.findLastIndex((value) => value !== null);
  if (at === -1) return null;
  return values[at] === 0
    ? `In fiscal ${latest} it ${none}: the cash flow statement shows $0 in fiscal ${years[at]} and leaves the line out after that, as statements leave out a line that is zero.`
    : `${name} has no line after fiscal ${years[at]}: a gap, not zero. Search the annual report for whether it stopped.`;
};

export const usesOfCash = (data: CompanyData): LookupResult => {
  const list = recent(data);
  const figures: Record<string, string> = {};
  const notes: Array<string> = [];
  const totals = uses.map((use) => {
    const values = list.map((year) => valueOf(year.terms[use.key]));
    values.forEach((value, index) => {
      figures[`${use.name}, fiscal ${list[index]!.fiscalYear}`] =
        value === null ? "gap" : money(value);
    });
    const known = values.filter((value): value is number => value !== null);
    const total = known.reduce((sum, value) => sum + value, 0);
    if (known.length === 0) {
      notes.push(`${use.name} has no separate line in these years: a gap, not zero.`);
    } else {
      figures[`${use.name}, total ${span(list)}`] = money(total);
    }
    if ("none" in use) {
      const note = latestYear(
        use.name,
        use.none,
        values,
        list.map((year) => year.fiscalYear),
      );
      if (note !== null) notes.push(note);
    }
    return { use, total, known: known.length };
  });
  const largest = [...totals].filter((each) => each.known > 0).sort((a, b) => b.total - a.total)[0];
  if (largest !== undefined)
    figures[`Largest part of capital allocation, ${span(list)}`] = largest.use.name;
  const compensation = list.map((year) => valueOf(year.terms.stockBasedCompensation));
  const paidInShares = compensation.filter((value): value is number => value !== null);
  if (paidInShares.length > 0) {
    figures[`Stock-based compensation, total ${span(list)}`] = money(
      paidInShares.reduce((sum, value) => sum + value, 0),
    );
    compensation.forEach((value, index) => {
      figures[`Stock-based compensation, fiscal ${list[index]!.fiscalYear}`] =
        value === null ? "gap" : money(value);
    });
  }
  notes.push(
    "Dividends are the total paid, not the amount for each share.",
    "The tool does not collect the number of shares, so it cannot say whether the count of shares went down.",
  );
  return {
    lookup: "uses_of_cash",
    title: `Capital allocation, ${span(list)}`,
    detail: `${list.length * uses.length} figures from the cash flow statement`,
    figures,
    notes,
    drawing: {
      kind: "bars",
      title: `What it did with its cash, ${span(list)}`,
      unit: "money",
      rows: true,
      series: uses.map((use) => ({
        name: use.name,
        term: use.term,
        tone: "grey" as const,
        points: list.map((year) => ({
          fiscalYear: year.fiscalYear,
          value: valueOf(year.terms[use.key]),
        })),
      })),
    },
    filings: filingsOf(
      data.cik,
      uses.map((use) => last(list).terms[use.key]),
    ),
  };
};
