import type { StatementYear } from "../server/terms/statements";
import { type FigureKey, figureOf } from "./figure-keys";
import { type CheckedFigure, valueOf } from "./figures";

// The six parts of a dollar of revenue, always in the same colours.
export const parts = [
  {
    key: "costOfRevenue",
    name: "Cost of revenue",
    color: "var(--color-part-cost)",
  },
  {
    key: "researchAndDevelopment",
    name: "Research and development",
    color: "var(--color-part-research)",
  },
  {
    key: "sellingGeneralAndAdministrative",
    name: "Selling, general and administrative",
    color: "var(--color-part-selling)",
  },
  {
    key: "otherOperatingExpenses",
    name: "Other operating expenses",
    color: "var(--color-part-other)",
  },
  {
    key: "below",
    name: "Interest, other income and tax",
    color: "var(--color-part-below)",
  },
  { key: "netIncome", name: "Net income", color: "var(--color-part-kept)" },
] as const satisfies ReadonlyArray<{
  key: FigureKey;
  name: string;
  color: string;
}>;

export type Part = (typeof parts)[number];
export type PartKey = Part["key"];

export type YearPart = Part & {
  readonly figure: CheckedFigure;
  readonly value: number | null;
};

export const yearParts = (year: StatementYear): ReadonlyArray<YearPart> =>
  parts.map((part) => {
    const figure = figureOf(year, part.key);
    return { ...part, figure, value: valueOf(figure) };
  });
