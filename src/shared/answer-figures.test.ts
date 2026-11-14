import { describe, expect, it } from "@effect/vitest";
import { figuresOf, splitFigures } from "./answer-figures";

const unchecked = (text: string, results: ReadonlyArray<Parameters<typeof figuresOf>[0]>) =>
  splitFigures(
    text,
    results.flatMap((result) =>
      figuresOf(result).map((figure) => ({
        text: figure,
        source: result.lookup,
      })),
    ),
  )
    .filter((piece) => piece.kind === "unchecked")
    .map((piece) => piece.text);

const report = {
  lookup: "search_report",
  figures: {
    "line 608":
      "In fiscal year 2026, we repurchased 282 million shares of our common stock for $40.4 billion. Revenue from outside the United States was 31% of total revenue.",
  },
};

describe("numbers an answer may use", () => {
  it("counts an amount written inside a paragraph of the annual report", () => {
    expect(
      unchecked(
        "NVIDIA repurchased shares for $40.4 billion, and 31% of revenue came from abroad.",
        [report],
      ),
    ).toEqual([]);
  });

  it("still marks an amount the paragraph does not hold", () => {
    expect(unchecked("NVIDIA repurchased shares for $41 billion.", [report])).toEqual([
      "$41 billion",
    ]);
  });

  it("counts a figure lookup's figures only as written whole", () => {
    const trend = {
      lookup: "trend",
      figures: { "Revenue, fiscal 2026": "$215.9 billion" },
    };
    expect(unchecked("Revenue was $215.9 billion, or $216 billion.", [trend])).toEqual([
      "$216 billion",
    ]);
  });
});
