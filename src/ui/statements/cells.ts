import { type FigureKey, ratioKeys } from "../../shared/figure-keys";
import { type CheckedFigure, valueOf } from "../../shared/figures";
import {
  moneyShort,
  perShare,
  signedPercent,
  signedPoints,
  yearOverYear,
} from "../../shared/format";
import type { Row, Unit } from "./rows";

export const most = 4;

export type Cell = { readonly key: FigureKey; readonly fy: number };

export const unitOf = (row: Row): Unit =>
  row.unit ?? (ratioKeys.has(row.key) ? "percent" : "money");

export const shortValue = (row: Row, value: number) => {
  const unit = unitOf(row);
  if (unit === "percent") return `${(value * 100).toFixed(1)}%`;
  if (unit === "perShare") return perShare(value);
  return moneyShort(value);
};

export const changeText = (row: Row, now: CheckedFigure, before: CheckedFigure | undefined) => {
  const a = valueOf(now);
  const b = valueOf(before);
  if (a === null || b === null) return null;
  if (unitOf(row) === "percent") return signedPoints((a - b) * 100);
  const delta = yearOverYear(a, b);
  return delta === null ? null : signedPercent(delta);
};

export const yearWindow = <Year>(years: ReadonlyArray<Year>, year: Year) => {
  const at = years.indexOf(year);
  const start = Math.max(0, Math.min(at, years.length - 10));
  return years.slice(start, start + 10);
};

const moves: Record<string, readonly [number, number]> = {
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  Home: [0, -99],
  End: [0, 99],
};

export const moveCell = (
  rows: ReadonlyArray<Row>,
  columns: ReadonlyArray<{ readonly fiscalYear: number }>,
  at: { readonly key: string | undefined; readonly fy: number },
  key: string,
): Cell | null => {
  const move = moves[key];
  if (move === undefined) return null;
  const r = rows.findIndex((row) => row.key === at.key);
  const c = columns.findIndex((each) => each.fiscalYear === at.fy);
  const nr = Math.max(0, Math.min(rows.length - 1, r + move[0]));
  const nc = Math.max(0, Math.min(columns.length - 1, c + move[1]));
  return { key: rows[nr]!.key, fy: columns[nc]!.fiscalYear };
};
