const entities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  mdash: "—",
  ndash: "–",
};

const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code.startsWith("#x") || code.startsWith("#X")) {
      return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    }
    if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)));
    return entities[code.toLowerCase()] ?? whole;
  });

// An annual report's text, one block of the page per line.
export const linesOf = (html: string) =>
  decode(
    html
      .replace(/<ix:header>[\s\S]*?<\/ix:header>/gi, "")
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<\/(p|div|td|th|tr|li|h[1-6]|table)>|<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .split("\n")
    .map((line) => line.replace(/[\s ]+/g, " ").trim())
    .filter((line) => line !== "");

const itemOne = /^item\s*1\s*[.:]?\s*[—–-]?\s*business\b/i;
const itemOneA = /^item\s*1a\b/i;
const sentenceEnd = /(?<=[a-z0-9)”"%][.])\s+(?=[A-Z“"])/;

// The opening of the business description: the first full paragraph after
// the "Item 1. Business" heading, skipping the table of contents and short
// sub-headings. It keeps up to three sentences and stops at one about the
// fiscal year, which is bookkeeping rather than the business.
export const openingOfBusiness = (html: string): string | null => {
  const lines = linesOf(html);
  for (let index = 0; index < lines.length; index++) {
    if (!itemOne.test(lines[index]!)) continue;
    const next = lines.slice(index + 1, index + 4);
    if (next.some((line) => itemOneA.test(line) || /^\d+$/.test(line))) continue;
    for (const line of lines.slice(index + 1, index + 30)) {
      if (itemOneA.test(line)) break;
      if (line.length < 80 || !/[.][\u201d"]?$/.test(line)) continue;
      const kept: Array<string> = [];
      for (const sentence of line.split(sentenceEnd)) {
        if (kept.length > 0 && /fiscal year/i.test(sentence)) break;
        if (kept.length > 0 && [...kept, sentence].join(" ").length > 420) break;
        kept.push(sentence);
        if (kept.length === 3) break;
      }
      return kept.join(" ");
    }
  }
  return null;
};
