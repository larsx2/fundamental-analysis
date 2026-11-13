import type { StatementYear } from "../../functions/company";
import { valueOf } from "../../shared/figures";
import { moneyShort } from "../../shared/format";
import {
  columnsHeight,
  fitScale,
  type FlowLink,
  type FlowNode,
  type FlowValues,
  type Layout,
  stack,
  stackUp,
} from "./flow-engine";

export type Lens = "profit" | "cash";

export type Part = FlowNode & {
  readonly name: string;
  readonly term: string;
  readonly lowerIsBetter?: boolean;
  readonly about?: string;
};

const part = (
  id: string,
  col: number,
  name: string,
  color: string,
  extra: Partial<Part> = {},
): Part => ({ id, col, name, term: name, color, ...extra });

export const profitParts: ReadonlyArray<Part> = [
  part("revenue", 0, "Revenue", "", { total: true }),
  part("cost", 1, "Cost of revenue", "var(--color-part-cost)", {
    lowerIsBetter: true,
  }),
  part("gross", 1, "Gross profit", "", { total: true }),
  part("research", 2, "Research and development", "var(--color-part-research)", {
    lowerIsBetter: true,
  }),
  part("selling", 2, "Selling, general and administrative", "var(--color-part-selling)", {
    lowerIsBetter: true,
  }),
  part("other", 2, "Other operating expenses", "var(--color-part-other)", {
    lowerIsBetter: true,
  }),
  part("operating", 2, "Operating income", "", { total: true }),
  part("interestIn", 2, "Interest and other income", "var(--color-part-interest)"),
  part("tax", 3, "Income tax", "var(--color-part-below)", {
    lowerIsBetter: true,
  }),
  part("interestOut", 3, "Interest and other income", "var(--color-part-interest)", {
    lowerIsBetter: true,
  }),
  part("net", 3, "Net income", "var(--color-part-kept)", { hero: true }),
];

const profitLinks: ReadonlyArray<FlowLink> = [
  { source: "revenue", target: "cost" },
  { source: "revenue", target: "gross" },
  { source: "gross", target: "research" },
  { source: "gross", target: "selling" },
  { source: "gross", target: "other" },
  { source: "gross", target: "operating" },
  { source: "operating", target: "tax" },
  { source: "operating", target: "interestOut" },
  { source: "operating", target: "net" },
  { source: "interestIn", target: "net" },
];

export const cashParts: ReadonlyArray<Part> = [
  part("profit", 0, "Net income", "var(--color-part-kept)"),
  part("wear", 0, "Depreciation and amortization", "var(--color-bar-neutral)"),
  part("shares", 0, "Stock-based compensation", "var(--color-bar-neutral)"),
  part("otherIn", 0, "Other cash from operations", "var(--color-bar-neutral)", {
    term: "Operating cash flow",
    about:
      "Cash the business brought in beyond net income and the costs that use no cash, mostly from paying suppliers later than customers pay.",
  }),
  part("savings", 0, "Taken from cash on hand", "var(--color-part-other)", {
    term: "Cash",
    lowerIsBetter: true,
    about:
      "The company paid out more than its business brought in this year, so the difference came from cash it already held.",
  }),
  part("pool", 1, "Cash to use", "", {
    total: true,
    term: "Operating cash flow",
    about: "Operating cash flow, plus anything taken from cash on hand.",
  }),
  part("tied", 2, "Cash tied up in operations", "var(--color-bar-neutral)", {
    term: "Operating cash flow",
    lowerIsBetter: true,
    about:
      "Cash that went into inventory, into what customers owe, and into other parts of running the business.",
  }),
  part("capex", 2, "Capital expenditure", "var(--color-part-cost)"),
  part("acquisitions", 2, "Acquisitions", "var(--color-part-research)", { term: "Acquisition" }),
  part("dividends", 2, "Dividends", "var(--color-part-other)", { term: "Dividend" }),
  part("buybacks", 2, "Share buybacks", "var(--color-part-other)", { term: "Share buyback" }),
  part("debt", 2, "Debt repaid", "var(--color-bar-neutral)", { term: "Debt" }),
  part("left", 2, "Left over", "var(--color-part-kept)", {
    hero: true,
    term: "Capital allocation",
    about:
      "What remained after capital expenditure, acquisitions, payouts to owners and debt repaid, before other investing and borrowing.",
  }),
];

const cashSources = ["profit", "wear", "shares", "otherIn", "savings"];
const cashUses = ["tied", "capex", "acquisitions", "dividends", "buybacks", "debt", "left"];
const cashLinks: ReadonlyArray<FlowLink> = [
  ...cashSources.map((source) => ({ source, target: "pool" })),
  ...cashUses.map((target) => ({ source: "pool", target })),
];

const positive = (value: number) => (value > 0 ? value : 0);

export const profitValues = (year: StatementYear): Record<string, number> | null => {
  const t = year.terms;
  const revenue = valueOf(t.revenue);
  const cost = valueOf(t.costOfRevenue);
  const operating = valueOf(t.operatingIncome);
  const net = valueOf(t.netIncome);
  if (revenue === null || revenue <= 0 || operating === null || net === null) return null;
  const gross = valueOf(t.grossProfit) ?? (cost === null ? null : revenue - cost);
  if (gross === null) return null;
  const cents = (dollars: number) => (dollars / revenue) * 100;
  const tax = valueOf(t.incomeTax);
  const taxKnown = tax !== null;
  const taxOut = taxKnown ? positive(tax) : 0;
  const between = net - operating + taxOut;
  const values: Record<string, number> = {
    revenue: 100,
    cost: positive(cents(revenue - gross)),
    gross: positive(cents(gross)),
    research: positive(cents(valueOf(t.researchAndDevelopment) ?? 0)),
    selling: positive(cents(valueOf(t.sellingGeneralAndAdministrative) ?? 0)),
    other: positive(cents(valueOf(t.otherOperatingExpenses) ?? 0)),
    operating: positive(cents(operating)),
    interestIn: positive(cents(between)),
    tax: cents(taxOut),
    interestOut: positive(cents(-between)),
    net: positive(cents(net)),
    revenueDollars: revenue,
    taxKnown: taxKnown ? 1 : 0,
    "signed:operating": cents(operating),
    "signed:net": cents(net),
  };
  values["operating>net"] = positive(values.operating! - values.tax! - values.interestOut!);
  values["interestIn>net"] = values.interestIn!;
  return values;
};

export const cashValues = (year: StatementYear): Record<string, number> | null => {
  const t = year.terms;
  const operating = valueOf(t.operatingCashFlow);
  if (operating === null) return null;
  const net = valueOf(t.netIncome) ?? 0;
  const wear = positive(valueOf(t.depreciationAndAmortization) ?? 0);
  const shares = positive(valueOf(t.stockBasedCompensation) ?? 0);
  const other = operating - positive(net) - wear - shares;
  const spend = {
    capex: positive(valueOf(t.capitalExpenditure) ?? 0),
    acquisitions: positive(valueOf(t.acquisitions) ?? 0),
    dividends: positive(valueOf(t.dividends) ?? 0),
    buybacks: positive(valueOf(t.shareBuybacks) ?? 0),
    debt: positive(valueOf(t.debtRepaid) ?? 0),
  };
  const spent = Object.values(spend).reduce((sum, value) => sum + value, 0);
  const left = operating - spent;
  const values: Record<string, number> = {
    profit: positive(net),
    wear,
    shares,
    otherIn: positive(other),
    savings: positive(-left),
    tied: positive(-other),
    ...spend,
    left: positive(left),
    operatingCashFlow: operating,
  };
  values.pool = cashSources.reduce((sum, id) => sum + values[id]!, 0);
  for (const source of cashSources) values[`${source}>pool`] = values[source]!;
  return values;
};

const gap = 26;
const middleColumn = ["research", "selling", "other", "operating", "interestIn"];
const rightColumn = ["tax", "interestOut", "net"];

const profitWhole: Layout = (width, height, lane, v) => {
  const k = fitScale(
    (scale) =>
      Math.max(
        columnsHeight([["cost", "gross"]], v, gap)(scale),
        columnsHeight([middleColumn, rightColumn], v, 64)(scale),
      ),
    100,
    height - 12,
  );
  const step = (width - lane) / 3;
  const at: Record<string, { x: number; y: number }> = {
    revenue: { x: 0, y: 0 },
  };
  stack(["cost", "gross"], step, 0, k, v, gap, at);
  stackUp(
    ["research", "selling", "other", "operating", "interestIn"],
    2 * step,
    height - 12,
    k,
    v,
    64,
    at,
  );
  stackUp(["tax", "interestOut", "net"], 3 * step, height - 12, k, v, 64, at);
  return { k, at };
};

const profitZoomed: Layout = (width, height, lane, v) => {
  const middle = middleColumn;
  const k = fitScale(
    (scale) => {
      const at: Record<string, { x: number; y: number }> = {};
      const middleBottom = stack(middle, 0, 0, scale, v, gap, at);
      const rightBottom = stack(rightColumn, 0, at.operating!.y, scale, v, gap, {});
      return Math.max(middleBottom, rightBottom);
    },
    (v.gross ?? 0) + (v.interestIn ?? 0),
    height - 12,
  );
  const step = (width - lane) / 2;
  const above = -(v.cost ?? 0) * k - gap;
  const at: Record<string, { x: number; y: number; o?: number }> = {
    revenue: { x: -step, y: above, o: 0 },
    cost: { x: 0, y: above, o: 0 },
    gross: { x: 0, y: 0 },
  };
  stack(middle, step, 0, k, v, gap, at);
  stack(rightColumn, 2 * step, at.operating!.y, k, v, gap, at);
  return { k, at };
};

const cashLayout: Layout = (width, height, lane, v) => {
  const k = fitScale(
    (scale) =>
      Math.max(columnsHeight([cashSources], v, 28)(scale), columnsHeight([cashUses], v, 22)(scale)),
    v.pool ?? 0,
    height - 12,
  );
  const step = (width - lane) / 2;
  const at: Record<string, { x: number; y: number }> = {};
  stack(cashSources, 0, 0, k, v, 28, at);
  at.pool = { x: step, y: (height - 12 - (v.pool ?? 0) * k) / 2 };
  stack(cashUses, 2 * step, 0, k, v, 22, at);
  return { k, at };
};

export const layouts: Record<Lens, readonly [Layout, Layout]> = {
  profit: [profitWhole, profitZoomed],
  cash: [cashLayout, cashLayout],
};

export const links: Record<Lens, ReadonlyArray<FlowLink>> = {
  profit: profitLinks,
  cash: cashLinks,
};

export const partsOf = (lens: Lens) => (lens === "profit" ? profitParts : cashParts);

export const valuesOf = (lens: Lens, year: StatementYear) =>
  lens === "profit" ? profitValues(year) : cashValues(year);

export const nameOf = (lens: Lens, id: string, values: FlowValues) => {
  if (lens === "profit" && id === "interestOut" && values.taxKnown === 0) {
    return "Interest, other income and tax";
  }
  return partsOf(lens).find((each) => each.id === id)?.name ?? id;
};

export const termOf = (lens: Lens, id: string, values: FlowValues) =>
  lens === "profit" && id === "interestOut" && values.taxKnown === 0
    ? "Interest, other income and tax"
    : (partsOf(lens).find((each) => each.id === id)?.term ?? "");

export const cents = (value: number) => `${value.toFixed(Math.abs(value) < 10 ? 2 : 1)}¢`;

export const amountOf = (lens: Lens, id: string, values: FlowValues) => {
  if (lens === "cash") return { main: moneyShort(values[id] ?? 0), sub: "" };
  const revenue = values.revenueDollars ?? 0;
  if (id === "revenue") return { main: moneyShort(revenue), sub: "100¢" };
  const signed = values[`signed:${id}`];
  const shown = signed ?? values[id] ?? 0;
  const sign =
    id === "interestIn"
      ? "+"
      : id === "interestOut" && values.taxKnown === 1 && shown > 0
        ? "−"
        : "";
  return {
    main: `${sign}${cents(shown)}`,
    sub: moneyShort((shown / 100) * revenue),
  };
};
