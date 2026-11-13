import { describe, expect, it } from "vitest";
import { keyOfTerm } from "../shared/figure-keys";
import { parts } from "../shared/money-flow-parts";
import { termNames } from "../server/terms/term-tags";
import { cashParts, profitParts } from "../ui/money-flow/flows";
import { statements } from "../ui/statements/rows";
import { allTerms, findTerm } from "./glossary";

const screenFiles = import.meta.glob<string>(
  ["../routes/**/*.{ts,tsx}", "../ui/**/*.{ts,tsx}", "../shared/**/*.{ts,tsx}", "!**/*.test.*"],
  { query: "?raw", import: "default", eager: true },
);
const agentFiles = import.meta.glob<string>(["../server/agent/**/*.ts", "!**/*.test.*"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const shortPath = (path: string) => path.replace("../", "src/");

const fileEnding = (files: Record<string, string>, ending: string) =>
  Object.entries(files).find(([path]) => path.endsWith(ending))?.[1] ?? "";

const matchesIn = (source: string, pattern: RegExp) =>
  [...source.matchAll(pattern)].map((match) => match[1] ?? match[2] ?? "");

type Named = { readonly from: string; readonly name: string };

const termNamesOnScreens = (): ReadonlyArray<Named> => {
  const literals = [
    /<Term\s+name="([^"]+)"/g,
    /\bterm:\s*"([^"]+)"/g,
    /\b(?:termName|name)\s*[!=]==\s*"([A-Z][^"]*)"/g,
  ];
  const inSources = Object.entries({ ...screenFiles, ...agentFiles }).flatMap(([path, source]) =>
    literals.flatMap((pattern) =>
      matchesIn(source, pattern).map((name) => ({
        from: shortPath(path),
        name,
      })),
    ),
  );
  const unlinked = /const unlinked = new Set\(\[([^\]]*)\]/.exec(
    fileEnding(screenFiles, "/ui/ask/answer-text.tsx"),
  );
  const inTables: ReadonlyArray<Named> = [
    ...Object.keys(keyOfTerm).map((name) => ({ from: "keyOfTerm", name })),
    ...parts.map((part) => ({ from: "money-flow-parts", name: part.name })),
    ...[...profitParts, ...cashParts].map((part) => ({
      from: "money-flow flows",
      name: part.term,
    })),
    ...Object.values(statements).map((each) => ({
      from: "statements",
      name: each.title,
    })),
    ...Object.values(termNames).map((name) => ({ from: "termNames", name })),
    ...matchesIn(unlinked?.[1] ?? "", /"([^"]+)"/g).map((name) => ({
      from: "unlinked",
      name,
    })),
    ...matchesIn(fileEnding(screenFiles, "/routes/$ticker/overview.tsx"), /\bname: "([^"]+)"/g).map(
      (name) => ({ from: "overview figures", name }),
    ),
    ...matchesIn(fileEnding(agentFiles, "/lookups/marks.ts"), /\["[A-Za-z]+", "([^"]+)"\]/g).map(
      (name) => ({ from: "marks lookup", name }),
    ),
    ...matchesIn(fileEnding(screenFiles, "/ui/ask/drawing.tsx"), /block\([^\n]*"([^"]+)"\)/g).map(
      (name) => ({ from: "balance drawing", name }),
    ),
  ];
  return [...inSources, ...inTables];
};

const allowedPhrases = ["did not report", "does not report", "not zero"];

const wordPattern = (phrase: string, plural: boolean) =>
  new RegExp(
    `(?<![a-z0-9&-])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${plural ? "s?" : ""}(?![a-z0-9&-])`,
    "gi",
  );

const spansOf = (text: string, patterns: ReadonlyArray<{ phrase: string; pattern: RegExp }>) =>
  patterns.flatMap(({ phrase, pattern }) =>
    [...text.matchAll(pattern)].map((match) => ({
      phrase,
      start: match.index,
      end: match.index + match[0].length,
    })),
  );

const proseIn = (source: string) => {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const inJsx = matchesIn(code, /(?<=[^=-]>|\})([^<>{}=;()]+)(?=[<{])/g).filter(
    (text) =>
      /^\s*[A-Za-z]/.test(text) && !/`|^\s*(return|const|let|else|catch|finally|case)\b/.test(text),
  );
  const inStrings = matchesIn(code, /"([^"\n]*)"|`([^`]*)`/g).filter((text) =>
    /^[A-Za-z$]\S*(\s+\S+){2,}/.test(text),
  );
  return [...inJsx, ...inStrings];
};

describe("the words on screen against the glossary", () => {
  it("names only terms the glossary holds", () => {
    const named = termNamesOnScreens();
    expect(named.map((each) => each.name)).toContain("Free cash flow");
    const unknown = named
      .filter((each) => findTerm(each.name) === undefined)
      .map((each) => `${each.from}: "${each.name}"`);
    expect([...new Set(unknown)]).toEqual([]);
  });

  it("uses no word the glossary says to avoid", () => {
    const officialNames = allTerms.flatMap((term) => [
      term.name,
      term.name.replace(/ \(.*\)$/, ""),
    ]);
    const officialLowercase = new Set(officialNames.map((name) => name.toLowerCase()));
    const avoided = [
      ...new Set(
        allTerms
          .flatMap((term) => term.avoid.split(","))
          .map((entry) => entry.trim())
          .filter((entry) => entry !== "" && !/^(using|plain) /i.test(entry))
          .map((entry) => entry.replace(/^"(.*)"$/, "$1").toLowerCase()),
      ),
    ].filter((entry) => !officialLowercase.has(entry));
    const patternsOf = (phrases: ReadonlyArray<string>, plural: boolean) =>
      phrases.map((phrase) => ({
        phrase,
        pattern: wordPattern(phrase, plural),
      }));
    const avoidedPatterns = patternsOf(avoided, false);
    const protectedPatterns = patternsOf([...officialNames, ...allowedPhrases], true);

    const hits = Object.entries(screenFiles).flatMap(([path, source]) =>
      proseIn(source).flatMap((raw) => {
        const text = raw
          .replace(/\$\{[^}]*\}/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const protectedSpans = spansOf(text, protectedPatterns);
        return spansOf(text, avoidedPatterns)
          .filter(
            (word) =>
              !protectedSpans.some((span) => span.start <= word.start && word.end <= span.end),
          )
          .map((word) => `${shortPath(path)}: "${text}" uses "${word.phrase}"`);
      }),
    );
    expect(avoided).toContain("net sales");
    expect([...new Set(hits)]).toEqual([]);
  });
});
