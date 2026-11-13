import { Option } from "effect";
import { dayInMilliseconds, daysBetween } from "./days";

// A fiscal year is 52 or 53 weeks, or a calendar year: 363 to 370 days
// between its first and last day. The margin allows for odd calendars.
const isFullYear = (start: string, end: string) => {
  const days = daysBetween(start, end);
  return days >= 357 && days <= 372;
};

// The SEC's own `fy` label is the year of the filing a number appeared in,
// not the year the number is about, so it is never used.
// Named by the year of its end date less a week, so a year ending 1 January takes the year before.
export const fiscalYearOf = (period: {
  readonly start?: string | undefined;
  readonly end: string;
}) => {
  if (period.start !== undefined && !isFullYear(period.start, period.end)) return Option.none();
  return Option.some(new Date(Date.parse(period.end) - 7 * dayInMilliseconds).getUTCFullYear());
};
