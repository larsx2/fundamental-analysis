import { linesOf } from "./business-description";

export type Paragraph = {
  readonly line: number;
  readonly text: string;
  readonly heading: boolean;
  readonly section: string;
};

const wordCount = (line: string) => line.split(" ").length;

const hasWords = (line: string | undefined) => line !== undefined && /[A-Za-z]{2}/.test(line);

// Prose, not a table row: enough words, and mostly letters rather than figures.
const isProse = (line: string) =>
  wordCount(line) >= 6 && (line.match(/[A-Za-z]/g) ?? []).length / line.length > 0.6;

const isCaption = (line: string) => /^\([^()]*\)$/.test(line);

type Line = { readonly text: string; readonly rank: number };

const pageFurniture = (lines: ReadonlyArray<Line>) => {
  const texts = lines.map((line) => line.text);
  const pageNumber = texts.map(
    (text, index) =>
      /^\d{1,3}$/.test(text) && hasWords(texts[index - 1]) && hasWords(texts[index + 1]),
  );
  const keys = lines.map((line) => `${line.rank} ${line.text}`);
  const seen = new Map<string, { all: number; nearPageNumber: number }>();
  keys.forEach((key, index) => {
    const count = seen.get(key) ?? { all: 0, nearPageNumber: 0 };
    count.all += 1;
    if ([-2, -1, 1, 2].some((step) => pageNumber[index + step])) count.nearPageNumber += 1;
    seen.set(key, count);
  });
  return texts.map((text, index) => {
    const count = seen.get(keys[index]!)!;
    return (
      pageNumber[index]! ||
      text.includes("|") ||
      (hasWords(text) &&
        (count.all >= 20 || (count.all >= 3 && count.nearPageNumber * 2 >= count.all)))
    );
  });
};

const prominence = (style: string, text: string) => {
  const size = /font-size:\s*([\d.]+)(pt|px)/i.exec(style);
  const points = size === null ? 0 : Number(size[1]) * (size[2]!.toLowerCase() === "px" ? 0.75 : 1);
  return (
    Math.round(points * 10) * 100 +
    (/text-decoration:[^;]*underline/i.test(style) ? 8 : 0) +
    (/[a-z]/.test(text) ? 0 : 4) +
    (/font-weight:\s*(bold|[6-9]00)/i.test(style) ? 2 : 0) +
    (/font-style:\s*italic/i.test(style) ? 0 : 1)
  );
};

const styleMark = /\ue000([^\ue001]*)\ue001/;

const styledLinesOf = (html: string): ReadonlyArray<Line> =>
  linesOf(
    html.replace(
      /<span\b[^>]*\bstyle="([^"]*)"[^>]*>/gi,
      (tag, style: string) => `${tag}\ue000${style}\ue001`,
    ),
  ).flatMap((line) => {
    const text = line.replace(new RegExp(styleMark, "g"), "").replace(/\s+/g, " ").trim();
    return text === "" ? [] : [{ text, rank: prominence(styleMark.exec(line)?.[1] ?? "", text) }];
  });

const sectionsOf = (lines: ReadonlyArray<Line>) => {
  const texts = lines.map((line) => line.text);
  const furniture = pageFurniture(lines);
  const isLabel = new Array<boolean>(lines.length).fill(false);
  const isHeading = new Array<boolean>(lines.length).fill(false);
  let leadsToProse = false;
  for (let index = texts.length - 1; index >= 0; index--) {
    const text = texts[index]!;
    isLabel[index] =
      !furniture[index] &&
      hasWords(text) &&
      (wordCount(text) <= 12 || /^item\s*\d/i.test(text)) &&
      !/[.;,]$/.test(text) &&
      !(text.endsWith(":") && wordCount(text) > 6) &&
      !/^[•▪●◦·(–—-]/.test(text);
    if (isLabel[index]) isHeading[index] = leadsToProse;
    else if (isProse(text)) leadsToProse = true;
    else if (!furniture[index]) leadsToProse = false;
  }
  let open: ReadonlyArray<Line> = [];
  const sections = lines.map((line, index) => {
    const above = open
      .slice(-3)
      .map((each) => each.text)
      .join(" › ");
    if (isHeading[index]) open = [...open.filter((each) => each.rank > line.rank), line];
    return above;
  });
  return { isLabel, sections };
};

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
  const styled = styledLinesOf(html);
  const lines = styled.map((line) => line.text);
  const headings = new Set(riskHeadings(html, lines));
  const { isLabel, sections } = sectionsOf(styled);
  return lines.flatMap((text, line) =>
    isProse(text) && !isCaption(text) && (!isLabel[line] || headings.has(line))
      ? [{ line, text, heading: headings.has(line), section: sections[line]! }]
      : [],
  );
};
