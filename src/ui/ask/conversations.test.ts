import { describe, expect, it } from "@effect/vitest";
import { companiesOf, type Thread, type Turn } from "./conversations";

const apple = { ticker: "AAPL", cik: 320193, name: "Apple Inc." };
const costco = { ticker: "COST", cik: 909832, name: "COSTCO WHOLESALE CORP /NEW" };

const turn = (fields: Partial<Turn>): Turn => ({
  id: crypto.randomUUID(),
  question: "A question?",
  year: null,
  askedAt: 1,
  state: {
    lookups: [],
    steps: [],
    answer: null,
    failure: null,
    startedAt: null,
    finishedAt: null,
    stopped: false,
    done: true,
  },
  ...fields,
});

const thread = (turns: ReadonlyArray<Turn>, first: typeof apple | null = null): Thread => ({
  id: "thread",
  ticker: first?.ticker ?? null,
  cik: first?.cik ?? null,
  name: first?.name ?? null,
  turns,
  updatedAt: 1,
});

describe("the companies of a conversation", () => {
  it("lists each company once, in the order it came up", () => {
    const turns = [
      turn({ companies: [] }),
      turn({ companies: [apple] }),
      turn({ companies: [costco, apple] }),
    ];
    expect(companiesOf(thread(turns)).map((each) => each.ticker)).toEqual(["AAPL", "COST"]);
  });

  it("reads questions saved with a single company", () => {
    const turns = [turn({ ticker: "COST", cik: 909832, name: "COSTCO WHOLESALE CORP /NEW" })];
    expect(companiesOf(thread(turns))).toEqual([costco]);
  });

  it("falls back to the conversation's own company", () => {
    expect(companiesOf(thread([turn({})], apple))).toEqual([apple]);
  });

  it("has none for a conversation of general questions", () => {
    expect(companiesOf(thread([turn({ companies: [] })]))).toEqual([]);
  });
});
