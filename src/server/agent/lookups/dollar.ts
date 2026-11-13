import { valueOf } from "../../../shared/figures";
import type { LookupResult } from "../../../shared/lookups";
import { centsOfDollar, money } from "../../../shared/format";
import { yearParts } from "../../../shared/money-flow-parts";
import { type CompanyData, LookupProblem, filingsOf, pickYear } from "./common";

export const dollar = (data: CompanyData, input: { readonly fiscalYear: number | undefined }) => {
  const year = pickYear(data, input.fiscalYear);
  const revenue = valueOf(year.terms.revenue);
  if (revenue === null || revenue <= 0) {
    throw new LookupProblem({
      message: `${data.name}'s revenue for fiscal ${year.fiscalYear} is a gap.`,
    });
  }
  const parts = yearParts(year);
  const cents = centsOfDollar(
    parts.map((part) => part.value),
    revenue,
  );
  const figures: Record<string, string> = {
    [`Revenue, fiscal ${year.fiscalYear}`]: money(revenue),
  };
  const notes: Array<string> = [];
  const drawn: Array<{ key: string; name: string; cents: number }> = [];
  parts.forEach((part, index) => {
    const share = cents[index] ?? 0;
    if (part.value === null) {
      if (part.key !== "below") notes.push(`${part.name} is a gap: not reported as its own line.`);
      return;
    }
    figures[`${part.name}, fiscal ${year.fiscalYear}`] = money(part.value);
    if (part.value > 0) {
      figures[`${part.name}, cents of each dollar of revenue`] = `${share}¢`;
      if (share > 0) drawn.push({ key: part.key, name: part.name, cents: share });
    }
  });
  const net = parts.find((part) => part.key === "netIncome")!;
  if (net.value !== null && net.value < 0) {
    notes.push(`Net income was a loss in fiscal ${year.fiscalYear}.`);
  }
  const largest = [...drawn]
    .filter((part) => part.key !== "netIncome")
    .sort((a, b) => b.cents - a.cents)[0];
  if (largest !== undefined) figures["Largest part of each dollar"] = largest.name;
  notes.push("Net income is what is left of each dollar, not what the company keeps.");
  return {
    lookup: "dollar",
    title: `Income statement, fiscal ${year.fiscalYear}`,
    detail: "Each part as cents of each dollar of revenue, worked out by the tool",
    figures,
    notes,
    drawing: {
      kind: "dollar",
      title: `Each dollar of revenue in fiscal ${year.fiscalYear}`,
      fiscalYear: year.fiscalYear,
      parts: drawn,
    },
    filings: filingsOf(data.cik, [year.terms.revenue, year.terms.netIncome]),
  } satisfies LookupResult;
};
