import type { CollectReport } from "../server/collect";
import type { CheckedFigure, TermTable } from "../server/terms/choose-terms";
import { termKeys, termNames } from "../server/terms/term-tags";

const columnWidth = 14;
const millions = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const cell = (figure: CheckedFigure) => {
  if (figure.kind === "gap") return "gap";
  const mark = figure.doubtful !== null ? " ?" : figure.kind === "calculated" ? " c" : "  ";
  return `${millions.format(figure.value / 1_000_000)}${mark}`;
};

const wrap = (text: string, width: number) => {
  const lines: Array<string> = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line !== "" && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line === "" ? word : `${line} ${word}`;
    }
  }
  return [...lines, line];
};

export const printTerms = (
  title: string,
  table: TermTable,
  report: CollectReport,
): ReadonlyArray<string> => {
  const headers = ["Fiscal year", ...termKeys.map((term) => termNames[term])].map((name) =>
    wrap(name, columnWidth - 2),
  );
  const headerLines = Math.max(...headers.map((header) => header.length));
  const out: Array<string> = [title, "In millions of dollars.", ""];

  for (let line = 0; line < headerLines; line++) {
    out.push(
      headers
        .map((header, column) => {
          const text = header[line] ?? "";
          return column === 0 ? text.padEnd(columnWidth) : text.padStart(columnWidth);
        })
        .join(""),
    );
  }
  for (const year of table.fiscalYears) {
    out.push(
      [
        String(year.fiscalYear).padEnd(columnWidth),
        ...termKeys.map((term) => cell(year.terms[term]).padStart(columnWidth)),
      ].join(""),
    );
  }
  out.push(
    "",
    "c is a calculated number. ? is a doubtful number. gap means the company does not report it.",
  );

  const doubtful = table.fiscalYears.flatMap((year) =>
    termKeys.flatMap((term) => {
      const reason = year.terms[term].doubtful;
      return reason === null
        ? []
        : [`  Fiscal ${year.fiscalYear}, ${termNames[term].toLowerCase()}: ${reason}`];
    }),
  );
  if (doubtful.length > 0) out.push("", "Doubtful numbers:", ...doubtful);

  if (table.unlisted.length > 0) {
    out.push(
      "",
      "Related tags on no list:",
      ...table.unlisted.map(
        (tag) =>
          `  ${termNames[tag.term]}: ${tag.tag} (${tag.fiscalYears[0]} to ${tag.fiscalYears.at(-1)})`,
      ),
    );
  }

  if (report.unexpected.length > 0) {
    out.push(
      "",
      `Numbers in an unexpected shape: ${report.unexpected.length}`,
      ...report.unexpected
        .slice(0, 5)
        .map((number) => `  ${number.taxonomy} ${number.tag} ${number.unit}: ${number.reason}`),
    );
  }
  return out;
};
