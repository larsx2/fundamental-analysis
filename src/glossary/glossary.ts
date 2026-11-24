import source from "../../GLOSSARY.md?raw";

export type GlossaryTerm = {
  readonly name: string;
  readonly slug: string;
  readonly definition: string;
  readonly example: string;
  readonly alsoCalled: string;
  readonly avoid: string;
  readonly section: number;
};

export type GlossarySection = {
  readonly number: number;
  readonly title: string;
  readonly slug: string;
  readonly note: string;
  readonly terms: ReadonlyArray<GlossaryTerm>;
};

export type Glossary = {
  readonly intro: string;
  readonly sections: ReadonlyArray<GlossarySection>;
};

export const slugOf = (text: string) =>
  text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

// GLOSSARY.md is the only source of the words on screen. Each section is a
// `### N. Title` heading, and each term is a bold name followed by its
// definition and an `_Example_:` line, then optionally an `_Also called_:` line
// for the names filings and articles use, and an `_Avoid_:` line for words the
// tool does not use for this term. Either list may end a name with a note in
// brackets, and the second may hold a misuse written as `"word" for something`.
export const parseGlossary = (markdown: string): Glossary => {
  const lines = markdown.split("\n");
  const intro: Array<string> = [];
  const sections: Array<{
    number: number;
    title: string;
    note: Array<string>;
    terms: Array<{
      name: string;
      definition: Array<string>;
      example: string;
      alsoCalled: string;
      avoid: string;
    }>;
  }> = [];
  let place: "intro" | "before" | "section" = "before";

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("# ")) {
      place = "intro";
      continue;
    }
    if (line.startsWith("## ")) {
      place = "before";
      continue;
    }
    const heading = /^### (\d+)\. (.+)$/.exec(line);
    if (heading !== null) {
      sections.push({
        number: Number(heading[1]),
        title: heading[2]!,
        note: [],
        terms: [],
      });
      place = "section";
      continue;
    }
    if (line === "") continue;
    if (place === "intro") {
      intro.push(line);
      continue;
    }
    const section = sections.at(-1);
    if (place !== "section" || section === undefined) continue;
    const name = /^\*\*(.+)\*\*:$/.exec(line);
    if (name !== null) {
      section.terms.push({
        name: name[1]!,
        definition: [],
        example: "",
        alsoCalled: "",
        avoid: "",
      });
      continue;
    }
    const term = section.terms.at(-1);
    const example = /^_Example_:\s*(.*)$/.exec(line);
    const alsoCalled = /^_Also called_:\s*(.*)$/.exec(line);
    const avoid = /^_Avoid_:\s*(.*)$/.exec(line);
    if (term === undefined) section.note.push(line);
    else if (example !== null) term.example = example[1]!;
    else if (alsoCalled !== null) term.alsoCalled = alsoCalled[1]!;
    else if (avoid !== null) term.avoid = avoid[1]!;
    else term.definition.push(line);
  }

  return {
    intro: intro.join(" "),
    sections: sections.map((section) => ({
      number: section.number,
      title: section.title,
      slug: slugOf(section.title),
      note: section.note.join(" "),
      terms: section.terms.map((term) => ({
        name: term.name,
        slug: slugOf(term.name),
        definition: term.definition.join(" "),
        example: term.example,
        alsoCalled: term.alsoCalled,
        avoid: term.avoid,
        section: section.number,
      })),
    })),
  };
};

export const glossary = parseGlossary(source);

const byName = new Map(
  glossary.sections.flatMap((section) =>
    section.terms.map((term) => [term.name.toLowerCase(), term] as const),
  ),
);

export const findTerm = (name: string) => byName.get(name.toLowerCase());

export const allTerms = glossary.sections.flatMap((section) => section.terms);

export const plainName = (name: string) => name.replace(/ \(.*\)$/, "");

export const entriesIn = (list: string): ReadonlyArray<{ name: string; note: string }> =>
  list
    .split(/,(?![^()]*\))/)
    .map((entry) => /^(.*?)(?:\s+\(([^()]*)\))?$/.exec(entry.trim())!)
    .map(([, name = "", note = ""]) => ({ name: name.replace(/^"(.*)"$/, "$1"), note }))
    .filter(({ name }) => name !== "" && !name.startsWith('"') && !/^using /i.test(name));

export const namesIn = (list: string) => entriesIn(list).map((entry) => entry.name);

export const collisionsIn = (terms: ReadonlyArray<GlossaryTerm>) => {
  const sides = new Map<string, Array<{ term: string; note: string }>>();
  const add = (name: string, term: string, note: string) =>
    sides.set(name.toLowerCase(), [...(sides.get(name.toLowerCase()) ?? []), { term, note }]);
  for (const term of terms) {
    add(term.name, term.name, "");
    if (plainName(term.name) !== term.name) add(plainName(term.name), term.name, "");
    for (const entry of entriesIn(term.alsoCalled)) add(entry.name, term.name, entry.note);
  }
  return [...sides]
    .filter(([, owners]) => new Set(owners.map((owner) => owner.term)).size > 1)
    .map(([name, owners]) => ({
      name,
      terms: [...new Set(owners.map((owner) => owner.term))],
      noted: owners.some((owner) => owner.note !== ""),
    }));
};
