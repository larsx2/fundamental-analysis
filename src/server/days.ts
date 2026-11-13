import { Clock, Effect } from "effect";

export const dayInMilliseconds = 24 * 60 * 60 * 1000;

export const daysBetween = (from: string, to: string) =>
  Math.round((Date.parse(to) - Date.parse(from)) / dayInMilliseconds);

export const today = Clock.currentTimeMillis.pipe(
  Effect.map((now) => new Date(now).toLocaleDateString("en-CA")),
);
