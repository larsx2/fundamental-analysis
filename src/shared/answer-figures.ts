export type Piece =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "figure"; readonly text: string; readonly source: string }
  | { readonly kind: "unchecked"; readonly text: string };

export type KnownFigure = { readonly text: string; readonly source: string };

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const amount =
  /[+−-]?\$\d[\d,]*(?:\.\d+)?(?:\s(?:billion|million|trillion))?|[+−-]?\d[\d,]*(?:\.\d+)?\s?(?:%|¢|cents\b|points?\b)/g;

const plain = (text: string): ReadonlyArray<Piece> => {
  const pieces: Array<Piece> = [];
  let at = 0;
  for (const match of text.matchAll(amount)) {
    const start = match.index;
    if (start > at) pieces.push({ kind: "text", text: text.slice(at, start) });
    pieces.push({ kind: "unchecked", text: match[0] });
    at = start + match[0].length;
  }
  if (at < text.length) pieces.push({ kind: "text", text: text.slice(at) });
  return pieces;
};

export const splitFigures = (
  text: string,
  known: ReadonlyArray<KnownFigure>,
): ReadonlyArray<Piece> => {
  const usable = [
    ...new Map(
      known.filter((each) => /\d/.test(each.text)).map((each) => [each.text, each] as const),
    ).values(),
  ].sort((a, b) => b.text.length - a.text.length);
  if (usable.length === 0) return plain(text);
  const pattern = new RegExp(
    `(?<![\\w$.,+−-])(?:${usable.map((each) => escape(each.text)).join("|")})(?![\\w%¢])`,
    "g",
  );
  const pieces: Array<Piece> = [];
  let at = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > at) pieces.push(...plain(text.slice(at, start)));
    const figure = usable.find((each) => each.text === match[0])!;
    pieces.push({ kind: "figure", text: match[0], source: figure.source });
    at = start + match[0].length;
  }
  if (at < text.length) pieces.push(...plain(text.slice(at)));
  return pieces;
};
