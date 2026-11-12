import { describe, expect, it } from "vitest";
import { parseGlossary } from "./glossary";

const markdown = `# Fundamental Analysis

The words used to understand a company.

## Language

### 4. The income statement

**Interest, other income and tax**:
Everything between operating income and net income.
The tool works it out.
_Example_: Mostly income tax.
_Avoid_: Below the line

### 12. Collecting a company

These are the tool's own words, not words from the field.

**Gap**:
The empty place shown where a company does not report a term.
_Example_: Costco reports no research and development.
_Avoid_: Zero, N/A
`;

describe("the glossary file read into terms", () => {
  it("keeps a definition apart from its example and words to avoid, and a section's note apart from its terms", () => {
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
      avoid: "Below the line",
    });
  });
});
