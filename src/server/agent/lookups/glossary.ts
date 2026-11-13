import { findTerm, type GlossaryTerm } from "../../../glossary/glossary";
import type { LookupResult } from "../../../shared/lookups";
import { LookupProblem } from "./common";

export const glossaryLookup = (name: string): LookupResult => {
  const entry: GlossaryTerm | undefined = findTerm(name);
  if (entry === undefined) {
    throw new LookupProblem({ message: `The glossary has no term "${name}".` });
  }
  return {
    lookup: "glossary",
    title: `Glossary: ${entry.name}`,
    detail: "Definition and example",
    figures: {},
    notes: [`Definition: ${entry.definition}`, `Example: ${entry.example}`],
    drawing: null,
    filings: [],
  };
};
