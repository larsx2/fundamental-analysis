// The company and fiscal year last shown, so the bottom bar can return to
// them from a screen that has no company, such as the glossary. It is a
// convenience kept in this browser only, and the tool works without it.
const key = "last-company";

export type LastCompany = {
  readonly ticker: string;
  readonly year: number | null;
};

export const readLastCompany = (): LastCompany | null => {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (raw === null || raw === undefined) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || !("ticker" in value)) return null;
    const ticker = (value as { ticker: unknown }).ticker;
    const year = (value as { year?: unknown }).year;
    return typeof ticker === "string"
      ? { ticker, year: typeof year === "number" ? year : null }
      : null;
  } catch {
    return null;
  }
};

// The tickers of the companies shown most recently, newest first, so the
// home screen can offer the few you were reading.
const recentKey = "recent-companies";

export const readRecentTickers = (): ReadonlyArray<string> => {
  try {
    const value: unknown = JSON.parse(globalThis.localStorage?.getItem(recentKey) ?? "[]");
    return Array.isArray(value)
      ? value.filter((each): each is string => typeof each === "string")
      : [];
  } catch {
    return [];
  }
};

export const writeLastCompany = (company: LastCompany) => {
  try {
    globalThis.localStorage?.setItem(key, JSON.stringify(company));
    const recent = [
      company.ticker,
      ...readRecentTickers().filter((ticker) => ticker !== company.ticker),
    ].slice(0, 12);
    globalThis.localStorage?.setItem(recentKey, JSON.stringify(recent));
  } catch {
    // Private windows and blocked storage simply forget.
  }
};
