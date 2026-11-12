import type { ReactNode } from "react";
import { allTerms, findTerm } from "../../glossary/glossary";
import { type KnownFigure, splitFigures } from "../../shared/answer-figures";
import { Term } from "../term";

const unlinked = new Set([
  "Share",
  "Ticker",
  "Filing",
  "Quarter",
  "As of",
  "Ready",
  "Collecting",
  "Not collected",
  "Last checked",
  "Index",
  "Public company",
]);

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const termPattern = new RegExp(
  `\\b(${[...allTerms]
    .filter((term) => !unlinked.has(term.name))
    .sort((a, b) => b.name.length - a.name.length)
    .map((term) => escape(term.name))
    .join("|")})s?\\b`,
  "gi",
);

const termsIn = (text: string) =>
  [...text.matchAll(termPattern)].flatMap((match) => {
    const entry = findTerm(match[1] ?? "");
    return entry === undefined ? [] : [entry.name];
  });

export const termsToLink = (texts: ReadonlyArray<string>): ReadonlyArray<ReadonlySet<string>> => {
  const seen = new Set<string>();
  return texts.map((text) => {
    const here = new Set(termsIn(text).filter((name) => !seen.has(name)));
    for (const name of here) seen.add(name);
    return here;
  });
};

const withTerms = (
  text: string,
  linked: ReadonlySet<string>,
  done: Set<string>,
  key: string,
): ReadonlyArray<ReactNode> => {
  const nodes: Array<ReactNode> = [];
  let at = 0;
  for (const match of text.matchAll(termPattern)) {
    const entry = findTerm(match[1] ?? "");
    if (entry === undefined || !linked.has(entry.name) || done.has(entry.name)) continue;
    done.add(entry.name);
    if (match.index > at) nodes.push(text.slice(at, match.index));
    nodes.push(
      <Term key={`${key}-${match.index}`} name={entry.name}>
        {match[0]}
      </Term>,
    );
    at = match.index + match[0].length;
  }
  if (at < text.length) nodes.push(text.slice(at));
  return nodes;
};

export function AnswerText({
  text,
  known,
  linked,
  lit,
  onLight,
}: {
  readonly text: string;
  readonly known: ReadonlyArray<KnownFigure>;
  readonly linked: ReadonlySet<string>;
  readonly lit: string | null;
  readonly onLight: (source: string | null) => void;
}) {
  const done = new Set<string>();
  return (
    <>
      {splitFigures(text, known).map((piece, index) => {
        if (piece.kind === "figure") {
          return (
            <button
              key={index}
              type="button"
              className={`ask-figure ${lit === piece.source ? "lit" : ""}`}
              onMouseEnter={() => onLight(piece.source)}
              onMouseLeave={() => onLight(null)}
              onFocus={() => onLight(piece.source)}
              onBlur={() => onLight(null)}
            >
              {piece.text}
            </button>
          );
        }
        if (piece.kind === "unchecked") {
          return (
            <span
              key={index}
              className="ask-unchecked"
              title="This number did not come from a lookup"
            >
              {piece.text}
              <span className="visually-hidden"> (not from a lookup)</span>
            </span>
          );
        }
        return <span key={index}>{withTerms(piece.text, linked, done, String(index))}</span>;
      })}
    </>
  );
}

export const uncheckedIn = (texts: ReadonlyArray<string>, known: ReadonlyArray<KnownFigure>) =>
  texts.flatMap((text) => splitFigures(text, known)).filter((piece) => piece.kind === "unchecked")
    .length;
