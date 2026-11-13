import { valueOf } from "../../../shared/figures";
import type { LookupResult } from "../../../shared/lookups";
import { money } from "../../../shared/format";
import { type CompanyData, filingsOf, pickYear } from "./common";

export const balance = (data: CompanyData, input: { readonly fiscalYear: number | undefined }) => {
  const year = pickYear(data, input.fiscalYear);
  const t = year.terms;
  const assets = valueOf(t.assets);
  const liabilities = valueOf(t.liabilities);
  const equity = valueOf(t.equity);
  const debt = valueOf(t.debt);
  const cashHeld = valueOf(t.cash);
  const netDebt = valueOf(t.netDebt);
  const flow = valueOf(t.operatingCashFlow);
  const on = `end of fiscal ${year.fiscalYear}`;
  const write = (value: number | null) => (value === null ? "gap" : money(value));
  const figures: Record<string, string> = {
    [`Assets, ${on}`]: write(assets),
    [`Liabilities, ${on}`]: write(liabilities),
    [`Equity, ${on}`]: write(equity),
    [`Debt, ${on}`]: write(debt),
    [`Cash, ${on}`]: write(cashHeld),
    [`Net debt, ${on}`]: write(netDebt),
    [`Operating cash flow, fiscal ${year.fiscalYear}`]: write(flow),
  };
  const notes = [
    "Cash leaves out short-term investments, which the tool does not collect, so cash may read low and net debt high.",
  ];
  if (debt !== null && flow !== null && debt > 0 && flow > 0) {
    figures["One year of operating cash flow covers its debt"] =
      `${(flow / debt).toFixed(1)} times`;
    figures["Its debt equals this many years of operating cash flow"] = (debt / flow).toFixed(1);
    if (debt < flow) notes.push("Its debt is less than one year of its operating cash flow.");
  }
  if (netDebt !== null && netDebt < 0) notes.push("It held more cash than debt.");
  return {
    lookup: "balance",
    title: `Balance sheet, ${on}`,
    detail: "Reported numbers; debt and net debt worked out by the tool",
    figures,
    notes,
    drawing:
      assets === null || liabilities === null
        ? null
        : {
            kind: "balance",
            title: `Balance sheet, ${on}`,
            assets,
            liabilities,
            equity,
          },
    filings: filingsOf(data.cik, [t.assets, t.liabilities, t.cash, t.operatingCashFlow]),
  } satisfies LookupResult;
};
