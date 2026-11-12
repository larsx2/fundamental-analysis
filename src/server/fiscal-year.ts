import { Option } from "effect";

const dayInMilliseconds = 24 * 60 * 60 * 1000;

const daysBetween = (start: string, end: string) =>
  Math.round((Date.parse(end) - Date.parse(start)) / dayInMilliseconds);

// A fiscal year is 52 or 53 weeks, or a calendar year: 363 to 370 days
// between its first and last day. The margin allows for odd calendars.
const isFullYear = (start: string, end: string) => {
  const days = daysBetween(start, end);
  return days >= 357 && days <= 372;
};

// The SEC's own `fy` label is the year of the filing a number appeared in,
// not the year the number is about, so it is never used.
export const fiscalYearOf = (period: {
  readonly start?: string | undefined;
  readonly end: string;
}) => {
  if (period.start !== undefined && !isFullYear(period.start, period.end)) return Option.none();
  return Option.some(Number(period.end.slice(0, 4)));
};
