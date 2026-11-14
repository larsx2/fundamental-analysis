import { linesOf } from "./business-description";

export type Paragraph = {
  readonly line: number;
  readonly text: string;
  readonly heading: boolean;
};

const wordCount = (line: string) => line.split(" ").length;

// Prose, not a table row: enough words, and mostly letters rather than figures.
const isProse = (line: string) =>
  wordCount(line) >= 6 && (line.match(/[A-Za-z]/g) ?? []).length / line.length > 0.6;

// The body of Item 1A: the "Item 1A" heading followed by a long paragraph,
// which skips the table of contents, up to the next item.
const riskSection = (lines: ReadonlyArray<string>) => {
  const start = lines.findIndex((line, index) => {
    if (!/^item\s*1a\b/i.test(line)) return false;
    const next = lines.slice(index + 1, index + 6);
    return (
      next.some((each) => wordCount(each) >= 40) && !next.some((each) => /^item\s*1b\b/i.test(each))
    );
  });
  if (start < 0) return null;
  const after = lines.slice(start + 1).findIndex((line) => /^item\s*(1b|1c|2)\b/i.test(line));
  return { start, end: after < 0 ? lines.length : start + 1 + after };
};

// Most reports set each risk's heading as its own short sentence, followed by
// a longer paragraph that explains it.
const headingLines = (lines: ReadonlyArray<string>, start: number, end: number) =>
  lines.flatMap((line, index) => {
    if (index <= start || index >= end) return [];
    const words = wordCount(line);
    if (words < 6 || words > 60 || !line.endsWith(".") || line.startsWith("•")) return [];
    const next = lines.slice(index + 1, end).find((each) => wordCount(each) >= 6);
    return next !== undefined && wordCount(next) >= Math.max(40, 1.5 * words) ? [index] : [];
  });

// Some reports, Microsoft's among them, set each heading in bold at the start
// of its paragraph instead.
const boldOpenings = (html: string) =>
  [
    ...html.matchAll(
      /<p[^>]*>\s*(?:<[^>]+>\s*)*?<span[^>]*style="[^"]*(?:font-weight:\s*(?:bold|700)|font-style:\s*italic)[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    ),
  ]
    .map((match) => linesOf(match[1]!).join(" "))
    .filter((text) => wordCount(text) >= 6)
    .map((text) => text.slice(0, 40));

const boldLines = (lines: ReadonlyArray<string>, html: string, start: number, end: number) => {
  const openings = boldOpenings(html);
  return lines.flatMap((line, index) =>
    index > start &&
    index < end &&
    openings.some((opening) => line.startsWith(opening)) &&
    !lines[index - 1]?.startsWith(line.slice(0, 40))
      ? [index]
      : [],
  );
};

export const riskHeadings = (html: string, lines: ReadonlyArray<string> = linesOf(html)) => {
  const section = riskSection(lines);
  if (section === null) return [];
  const plain = headingLines(lines, section.start, section.end);
  const bold = boldLines(lines, html, section.start, section.end);
  return plain.length >= bold.length / 2 ? plain : bold;
};

export const paragraphsOf = (html: string): ReadonlyArray<Paragraph> => {
  const lines = linesOf(html);
  const headings = new Set(riskHeadings(html, lines));
  return lines.flatMap((text, line) =>
    isProse(text) ? [{ line, text, heading: headings.has(line) }] : [],
  );
};
