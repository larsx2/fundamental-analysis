import {
  allTerms,
  collisionsIn,
  findTerm,
  type GlossaryTerm,
  namesIn,
} from "../../../glossary/glossary";
import type { LookupResult } from "../../../shared/lookups";
import { LookupProblem } from "./common";

const shared = new Set(collisionsIn(allTerms).map((collision) => collision.name));

const calledBy = (name: string) =>
  shared.has(name.toLowerCase())
    ? undefined
    : allTerms.find((term) =>
        namesIn(term.alsoCalled).some((other) => other.toLowerCase() === name.toLowerCase()),
      );

export const glossaryLookup = (asked: string): LookupResult => {
  const name = asked.trim();
  const entry: GlossaryTerm | undefined = findTerm(name) ?? calledBy(name);
  if (entry === undefined) {
    throw new LookupProblem({ message: `The glossary has no term "${name}".` });
  }
  return {
    lookup: "glossary",
    title: `Glossary: ${entry.name}`,
    detail:
      entry.alsoCalled === "" ? "Definition and example" : "Definition, example and other names",
    figures: {},
    notes: [
      `Definition: ${entry.definition}`,
      `Example: ${entry.example}`,
      ...(entry.alsoCalled === "" ? [] : [`Also called: ${entry.alsoCalled}`]),
    ],
    drawing: null,
    filings: [],
  };
};
