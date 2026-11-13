import { valueOf } from "../../../shared/figures";
import type { LookupResult } from "../../../shared/lookups";
import { filingUrl, longDate, money, yearEndInWords } from "../../../shared/format";
import { type CompanyData, annualReport, filingsOf, last, notCollected, span } from "./common";

export const company = (data: CompanyData): LookupResult => {
  const latest = last(data.years);
  const revenue = valueOf(latest.terms.revenue);
  const description = data.description;
  const opening =
    description === null
      ? null
      : description.text.length > 700
        ? `${description.text.slice(0, 700).replace(/\s+\S*$/, "")}…`
        : description.text;
  return {
    lookup: "company",
    title: data.name,
    detail: `Ticker ${data.ticker}, ${span(data.years)} collected`,
    figures: {
      "Fiscal years collected": span(data.years),
      "Fiscal year ends": yearEndInWords(data.years.map((year) => year.endOn)),
      [`Revenue, fiscal ${latest.fiscalYear}`]: revenue === null ? "gap" : money(revenue),
    },
    notes: [
      ...(opening === null
        ? ["The business description is not collected for this company."]
        : [`Opening of its business description, in its own words: ${opening}`]),
      ...(data.unexpectedNumbers === 0
        ? []
        : [
            `${data.unexpectedNumbers === 1 ? "One number" : `${data.unexpectedNumbers} numbers`} the SEC holds for ${data.name} came in a shape the tool cannot read, so ${data.unexpectedNumbers === 1 ? "it was" : "they were"} left out.`,
          ]),
      ...notCollected.map((each) => `The tool does not collect ${each}.`),
      "The tool makes no forecasts and gives no advice on buying or selling.",
    ],
    drawing:
      description === null || opening === null
        ? null
        : {
            kind: "quote",
            title: "In its own words",
            text: opening,
            source: `The opening of the business description in its annual report (10-K), filed on ${longDate(description.filedOn)}.`,
            url: filingUrl(data.cik, description.accession, description.document),
          },
    filings:
      description === null
        ? filingsOf(data.cik, [latest.terms.revenue])
        : [
            {
              form: annualReport,
              filedOn: description.filedOn,
              url: filingUrl(data.cik, description.accession, description.document),
            },
          ],
  };
};
