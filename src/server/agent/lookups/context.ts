import { valueOf } from "../../../shared/figures";
import type { LookupResult } from "../../../shared/lookups";
import {
  filingUrl,
  longDate,
  monthName,
  signedPercent,
  yearOverYear,
} from "../../../shared/format";
import type { CorporateEvent } from "../../filings";
import {
  type CompanyData,
  currentReport,
  first,
  last,
  span,
  recessionYears,
  risingRateYears,
} from "./common";

const eventTitle = (event: CorporateEvent) =>
  event.kind === "business"
    ? "Acquisition or sale of a business completed"
    : "Change among directors or officers";

export const context = (data: CompanyData): LookupResult => {
  const list = data.years.slice(-5);
  const from = first(list).startOn.slice(0, 7);
  const to = last(list).endOn.slice(0, 7);
  const months = data.months.filter((month) => month.month >= from && month.month <= to);
  const events = data.events.filter((event) => {
    const date = event.reportDate ?? event.filedOn;
    return date >= first(list).startOn && date <= last(list).endOn;
  });
  const figures: Record<string, string> = {};
  const rates = months.filter((month) => month.interestRate !== null);
  const prices = months.filter((month) => month.inflation !== null);
  if (rates.length > 0) {
    figures[`Interest rate, ${monthName(first(rates).month)}`] =
      `${first(rates).interestRate!.toFixed(2)}%`;
    figures[`Interest rate, ${monthName(last(rates).month)}`] =
      `${last(rates).interestRate!.toFixed(2)}%`;
  }
  if (prices.length > 0) {
    figures[`Inflation, ${monthName(first(prices).month)}`] =
      `${first(prices).inflation!.toFixed(1)}%`;
    figures[`Inflation, ${monthName(last(prices).month)}`] =
      `${last(prices).inflation!.toFixed(1)}%`;
  }
  const recessionMonths = months.filter((month) => month.recession);
  figures[`Months of recession, ${span(list)}`] = String(recessionMonths.length);
  const all = data.months;
  const end = all.findLastIndex((month) => month.recession);
  if (end !== -1) {
    let start = end;
    while (start > 0 && all[start - 1]!.recession) start -= 1;
    figures["Last recession"] = `${monthName(all[start]!.month)} to ${monthName(all[end]!.month)}`;
  }
  const recession = recessionYears(data);
  const rising = risingRateYears(data);
  figures["Fiscal years a recession touched"] =
    recession.length === 0 ? "none" : recession.join(", ");
  figures["Fiscal years the interest rate rose by more than a point"] =
    rising.length === 0 ? "none" : rising.join(", ");
  for (const fiscalYear of [...new Set([...recession, ...rising])]) {
    const year = data.years.find((each) => each.fiscalYear === fiscalYear);
    const before = data.years.find((each) => each.fiscalYear === fiscalYear - 1);
    if (year === undefined || before === undefined) continue;
    for (const [key, name] of [
      ["revenue", "Revenue"],
      ["netIncome", "Net income"],
    ] as const) {
      const change = yearOverYear(valueOf(year.terms[key]), valueOf(before.terms[key]));
      if (change !== null)
        figures[`${name}, change in fiscal ${fiscalYear}`] = signedPercent(change);
    }
  }
  figures[`Corporate events reported, ${span(list)}`] = String(events.length);
  const latestEvent = events.at(-1);
  if (latestEvent !== undefined) {
    figures["Latest corporate event"] =
      `${eventTitle(latestEvent)}, ${longDate(latestEvent.reportDate ?? latestEvent.filedOn)}`;
  }
  return {
    lookup: "context",
    title: `Interest rate, inflation and corporate events, ${span(list)}`,
    detail: `${months.length} months from the US central bank's public data, and ${events.length} current reports (8-K)`,
    figures,
    notes: [
      "Corporate events here are the two kinds the SEC's item numbers name: a director or officer arriving or leaving, and a completed acquisition or sale of a business.",
      "One company's years show what happened at the same time, not what caused what.",
    ],
    drawing: {
      kind: "economy",
      title: `Around ${data.name}, ${span(list)}`,
      months,
      events: events.map((event) => ({
        date: event.reportDate ?? event.filedOn,
        title: eventTitle(event),
        url: filingUrl(data.cik, event.accession, event.document),
      })),
    },
    filings: events
      .slice(-3)
      .reverse()
      .map((event) => ({
        form: currentReport,
        filedOn: event.filedOn,
        url: filingUrl(data.cik, event.accession, event.document),
      })),
  };
};
