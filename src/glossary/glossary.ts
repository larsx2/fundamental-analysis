import source from "../../GLOSSARY.md?raw";

export type GlossaryTerm = {
  readonly name: string;
  readonly slug: string;
  readonly definition: string;
  readonly example: string;
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
// definition, an `_Example_:` line and an `_Avoid_:` line.
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
        avoid: "",
      });
      continue;
    }
    const term = section.terms.at(-1);
    const example = /^_Example_:\s*(.*)$/.exec(line);
    const avoid = /^_Avoid_:\s*(.*)$/.exec(line);
    if (term === undefined) section.note.push(line);
    else if (example !== null) term.example = example[1]!;
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
