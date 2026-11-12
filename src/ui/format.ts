const minus = "−";

const fixed = (value: number, digits: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const signOf = (value: number) => (value < 0 ? minus : "");

// Filed numbers are whole dollars. Screens show billions with one decimal,
// two below ten billion, and millions below one billion.
export const money = (dollars: number) => {
  const size = Math.abs(dollars);
  if (size === 0) return "$0";
  if (size < 1e6) return `${signOf(dollars)}$${Math.round(size).toLocaleString("en-US")}`;
  if (size < 1e9) {
    return `${signOf(dollars)}$${Math.round(size / 1e6).toLocaleString("en-US")} million`;
  }
  const b = size / 1e9;
  return `${signOf(dollars)}$${fixed(b, b >= 10 ? 1 : 2)} billion`;
};

export const moneyShort = (dollars: number) => {
  const size = Math.abs(dollars);
  if (size === 0) return "$0";
  if (size < 1e9) return `${signOf(dollars)}$${Math.round(size / 1e6).toLocaleString("en-US")}M`;
  const b = size / 1e9;
  return `${signOf(dollars)}$${fixed(b, b >= 10 ? 1 : 2)}B`;
};

export const moneyParts = (dollars: number) => {
  const [amount = "", unit = ""] = money(dollars).split(" ");
  return { amount, unit };
};

export const axisMoney = (dollars: number) => {
  if (dollars === 0) return "$0";
  const size = Math.abs(dollars);
  const text =
    size >= 1e9
      ? `$${+(size / 1e9).toFixed(size >= 1e10 ? 0 : 1)}B`
      : `$${Math.round(size / 1e6)}M`;
  return `${signOf(dollars)}${text}`;
};

export const percent = (share: number, digits = 1) =>
  `${signOf(share)}${fixed(Math.abs(share) * 100, digits)}%`;

export const signedPercent = (share: number, digits = 1) => {
  const text = fixed(Math.abs(share) * 100, digits);
  if (Number(text) === 0) return `${text}%`;
  return `${share > 0 ? "+" : minus}${text}%`;
};

export const signedPoints = (points: number) => {
  const text = fixed(Math.abs(points), 1);
  const sign = Number(text) === 0 ? "" : points > 0 ? "+" : minus;
  return `${sign}${text} ${text === "1.0" ? "point" : "points"}`;
};

export const perShare = (dollars: number) => `${signOf(dollars)}$${fixed(Math.abs(dollars), 2)}`;

export const rate = (value: number, digits = 2) =>
  `${signOf(value)}${fixed(Math.abs(value), digits)}%`;

// Year-over-year change, only where both years have a value of the same sign.
export const yearOverYear = (now: number | null, before: number | null) => {
  if (now === null || before === null || before === 0) return null;
  if (Math.sign(now) !== Math.sign(before)) return null;
  return (now - before) / Math.abs(before);
};

// Cents of each dollar, rounded so that they always add up to 100 the way a
// reader checks them: the largest remainders get the leftover cents.
export const centsOfDollar = (values: ReadonlyArray<number | null>, total: number) => {
  const raw = values.map((value) => (value === null || value <= 0 ? 0 : (value / total) * 100));
  const cents = raw.map(Math.floor);
  let left = 100 - cents.reduce((a, b) => a + b, 0);
  const order = raw
    .map((value, index) => ({
      remainder: value - Math.floor(value),
      index,
      value,
    }))
    .filter(({ value }) => value > 0)
    .sort((a, b) => b.remainder - a.remainder);
  for (const { index } of order) {
    if (left <= 0) break;
    cents[index] = (cents[index] ?? 0) + 1;
    left -= 1;
  }
  return cents;
};

const at = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00Z`);

export const longDate = (iso: string) =>
  at(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export const monthName = (month: string) =>
  at(`${month}-15`).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

export const monthShort = (month: string) =>
  at(`${month}-15`)
    .toLocaleDateString("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .replace("Sept", "Sep");

const monthOf = (date: Date) =>
  date.toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });

// Where in its month a company's fiscal year ends, in plain words, such as
// "late September" for a year of 52 or 53 weeks, or "on 30 June".
export const yearEndInWords = (ends: ReadonlyArray<string>) => {
  const dates = ends.map(at);
  const first = dates[0];
  if (first === undefined) return "";
  const lastDay = (date: Date) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  const sameDay = dates.every(
    (date) =>
      date.getUTCDate() === first.getUTCDate() && date.getUTCMonth() === first.getUTCMonth(),
  );
  if (sameDay) return `on ${first.getUTCDate()} ${monthOf(first)}`;
  // Count days from the nearest month end, so 3 September and 29 August are
  // both read as the end of August.
  const offsets = dates.map((date) =>
    date.getUTCDate() <= 7 ? date.getUTCDate() : date.getUTCDate() - lastDay(date),
  );
  const middle = [...offsets].sort((a, b) => a - b)[Math.floor(offsets.length / 2)] ?? 0;
  const sample =
    dates.find(
      (date) =>
        (date.getUTCDate() <= 7 ? date.getUTCDate() : date.getUTCDate() - lastDay(date)) === middle,
    ) ?? first;
  // Some years ending in early September and others in late August, as with
  // Costco's Sunday nearest 31 August, read as "around the end of August".
  const straddles = offsets.some((offset) => offset > 0) && offsets.some((offset) => offset <= 0);
  if (middle > 0 || straddles) {
    const end = middle > 0 ? sample : (dates.find((date) => date.getUTCDate() <= 7) ?? sample);
    const before = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 0));
    return `around the end of ${monthOf(before)}`;
  }
  if (middle >= -10) return `late ${monthOf(sample)}`;
  return sample.getUTCDate() <= 10 ? `early ${monthOf(sample)}` : `mid ${monthOf(sample)}`;
};

export const filingUrl = (cik: number, accession: string, document?: string | null) =>
  `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replaceAll("-", "")}/${document ?? ""}`;

export const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

export const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
