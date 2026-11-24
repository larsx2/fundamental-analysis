import { describe, expect, it } from "vitest";
import { allTerms, collisionsIn, namesIn, parseGlossary } from "./glossary";

const markdown = `# Fundamental Analysis

The words used to understand a company.

## Language

### 4. The income statement

**Interest, other income and tax**:
Everything between operating income and net income.
The tool works it out.
_Example_: Mostly income tax.
_Also called_: Non-operating items
_Avoid_: Below the line

### 12. Collecting a company

These are the tool's own words, not words from the field.

**Gap**:
The empty place shown where a company does not report a term.
_Example_: Costco reports no research and development.
_Avoid_: Zero, N/A

**Ready**:
The state of a company that can be opened.
_Example_: Costco is ready.

**As of**:
The date of the newest filing.
_Example_: As of 9 October.
_Avoid_: Updated
_Also called_: Data date
`;

describe("the glossary file read into terms", () => {
  it("keeps a definition apart from its example, other names and words not used, and a section's note apart from its terms", () => {
    const glossary = parseGlossary(markdown);
    expect(glossary.intro).toBe("The words used to understand a company.");
    expect(glossary.sections.map((section) => [section.number, section.note])).toEqual([
      [4, ""],
      [12, "These are the tool's own words, not words from the field."],
    ]);
    expect(glossary.sections[0]?.terms[0]).toMatchObject({
      name: "Interest, other income and tax",
      slug: "interest-other-income-and-tax",
      definition: "Everything between operating income and net income. The tool works it out.",
      example: "Mostly income tax.",
      alsoCalled: "Non-operating items",
      avoid: "Below the line",
    });
    expect(glossary.sections[1]?.terms.map((term) => [term.alsoCalled, term.avoid])).toEqual([
      ["", "Zero, N/A"],
      ["", ""],
      ["Data date", "Updated"],
    ]);
  });
});

const namesOf = (field: "alsoCalled" | "avoid") =>
  allTerms.flatMap((term) =>
    namesIn(term[field]).map((name) => ({ name: name.toLowerCase(), term: term.name })),
  );

const otherNames = namesOf("alsoCalled");
const unusedWords = namesOf("avoid");

const twoTerms = (first: string, second: string) =>
  parseGlossary(`### 1. Things

**Share**:
One unit of ownership.
_Example_: One Apple share.
_Also called_: ${first}

**Inventory**:
Goods not yet sold.
_Example_: Costco's shelves.
_Also called_: ${second}
`).sections.flatMap((section) => section.terms);

describe("the names in a list", () => {
  it("leave out a note in brackets, quotes and a misuse, and keep commas inside a note", () => {
    expect(
      namesIn(
        'Net sales (Apple\'s label; at Costco, without fees), "the market", "Stock" for inventory, other income and expense (Apple\'s label)',
      ),
    ).toEqual(["Net sales", "the market", "other income and expense"]);
  });

  it("let two terms share a name, or use another term's name, only with a note", () => {
    expect(collisionsIn(twoTerms("Stock", "Stock"))).toEqual([
      { name: "stock", terms: ["Share", "Inventory"], noted: false },
    ]);
    expect(collisionsIn(twoTerms("Stock", "Stock (British)"))).toEqual([
      { name: "stock", terms: ["Share", "Inventory"], noted: true },
    ]);
    expect(collisionsIn(twoTerms("Inventory", "Goods on hand"))[0]?.noted).toBe(false);
    expect(collisionsIn(twoTerms("Unit", "Goods on hand"))).toEqual([]);
  });
});

describe("the other names in the glossary", () => {
  it("are a bare word from another term's name only where that was chosen", () => {
    const clashes = otherNames.filter(({ name, term }) =>
      allTerms.some(
        (other) =>
          other.name !== term &&
          other.name
            .toLowerCase()
            .split(/[\s,()/-]+/)
            .includes(name),
      ),
    );
    expect(clashes).toEqual([
      { name: "stock", term: "Share" },
      { name: "q", term: "Quarter" },
      { name: "report", term: "Filing" },
      { name: "earnings", term: "Net income" },
      { name: "stock", term: "Inventory" },
    ]);
  });

  it("are shared, or another term's name, only with a note", () => {
    expect(collisionsIn(allTerms).filter((collision) => !collision.noted)).toEqual([]);
  });

  it("are never also listed as not used, for the same term or another", () => {
    expect(
      unusedWords.filter(({ name }) => otherNames.some((other) => other.name === name)),
    ).toEqual([]);
  });
});
