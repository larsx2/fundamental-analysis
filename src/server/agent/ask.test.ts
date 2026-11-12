import { describe, expect, it } from "@effect/vitest";
import { promptFor } from "./ask";

const apple = { name: "Apple Inc.", ticker: "AAPL" };
const costco = { name: "COSTCO WHOLESALE CORP /NEW", ticker: "COST" };

describe("what the agent is told", () => {
  it("answers a question with no company from the glossary", () => {
    const prompt = promptFor("What is gross profit?", []);
    expect(prompt).toContain("general question");
    expect(prompt).toContain("glossary lookup");
    expect(prompt).not.toContain("ticker");
    expect(prompt.endsWith("The question: What is gross profit?")).toBe(true);
  });

  it("names the one company a question is about", () => {
    const prompt = promptFor("Is Apple growing?", [apple]);
    expect(prompt).toContain("about Apple Inc. (ticker AAPL), a US public company");
    expect(prompt).toContain("three short questions about Apple Inc.");
    expect(prompt).not.toContain("compares like with like");
  });

  it("reads the same lookups for each company it compares", () => {
    const prompt = promptFor("Is Costco growing faster than Apple?", [costco, apple]);
    expect(prompt).toContain(
      "about COSTCO WHOLESALE CORP /NEW (ticker COST) and Apple Inc. (ticker AAPL), US public companies",
    );
    expect(prompt).toContain("compares like with like");
    expect(prompt).toContain("three short questions about these companies");
  });

  it("carries the earlier questions and answers of the conversation", () => {
    const prompt = promptFor("And the year before?", [apple], null, [
      { question: "Is Apple growing?", answer: "Yes. Revenue rose in fiscal 2026." },
    ]);
    expect(prompt).toContain(
      "Question: Is Apple growing?\nAnswer: Yes. Revenue rose in fiscal 2026.",
    );
    expect(prompt).toContain("Still take every figure from a lookup");
  });
});
