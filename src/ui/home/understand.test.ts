import { describe, expect, it } from "vitest";
import type { NamedCompany } from "../../functions/companies";
import type { Mention } from "../mention-input";
import {
  companyOf,
  isQuestion,
  screenFor,
  termIn,
  understand,
  wordsOf,
  yearIn,
} from "./understand";

const apple: Mention = { cik: 320193, ticker: "AAPL", name: "Apple Inc." };
const rivian: Mention = {
  cik: 1874178,
  ticker: "RIVN",
  name: "Rivian Automotive, Inc.",
};
const appleReady: NamedCompany = { ...apple, state: "ready" };
const rivianWaiting: NamedCompany = { ...rivian, state: "not_collected" };

type Scene = {
  named?: NamedCompany | null;
  mentioned?: Mention;
  ready?: ReadonlyArray<Mention>;
  isFetching?: boolean;
};

const read = (text: string, { named, mentioned, ready = [], isFetching = false }: Scene = {}) => {
  const trimmed = text.trim();
  const { term, asksMeaning } = wordsOf(trimmed);
  const company = companyOf(mentioned, ready, named, asksMeaning, trimmed);
  return understand({
    trimmed,
    term,
    asksMeaning,
    mentioned: mentioned !== undefined,
    company,
    isFetching,
  });
};

describe("what Enter does with what was typed", () => {
  it("opens the glossary for a question about a word, whatever company was found before", () => {
    expect(read("What is gross profit?", { named: appleReady })).toMatchObject({
      kind: "term",
      term: { name: "Gross profit", slug: "gross-profit" },
    });
  });

  it("opens the glossary for a word on its own, even while the company lookup is running", () => {
    expect(read("gross profit", { isFetching: true })).toMatchObject({
      kind: "term",
      term: { name: "Gross profit" },
    });
  });

  it("asks about a ready company when the text is a question, even one that names a screen", () => {
    expect(read("Is Apple growing?", { named: appleReady })).toEqual({
      kind: "ask",
      company: appleReady,
    });
    expect(read("Where does Apple's money go?", { named: appleReady })).toMatchObject({
      kind: "ask",
    });
  });

  it("opens statements on the balance tab for a balance sheet in a given year", () => {
    expect(read("Apple's balance sheet in 2020", { named: appleReady })).toEqual({
      kind: "screen",
      company: appleReady,
      destination: {
        screen: "statements",
        label: "the statements",
        tab: "balance",
      },
      year: 2020,
    });
  });

  it("opens statements on the cash tab for capital expenditure", () => {
    expect(read("Apple's capital expenditure", { named: appleReady })).toEqual({
      kind: "screen",
      company: appleReady,
      destination: {
        screen: "statements",
        label: "the statements",
        tab: "cash",
      },
      year: null,
    });
  });

  it("opens where the money goes for a question about where it goes", () => {
    expect(read("Apple where does the money go", { named: appleReady })).toEqual({
      kind: "screen",
      company: appleReady,
      destination: {
        screen: "where-the-money-goes",
        label: "where the money goes",
      },
      year: null,
    });
  });

  it("opens the timeline for share buybacks, and the overview for a company alone", () => {
    expect(read("Apple share buybacks", { named: appleReady })).toMatchObject({
      kind: "screen",
      destination: { screen: "timeline", label: "the timeline" },
    });
    expect(read("Apple", { named: appleReady })).toMatchObject({
      kind: "screen",
      destination: { screen: "overview", label: "the overview" },
    });
  });

  it("sends a company not yet collected to Companies, question or not", () => {
    expect(read("Rivian", { named: rivianWaiting })).toEqual({
      kind: "collect",
      company: rivianWaiting,
    });
    expect(read("Is Rivian growing?", { named: rivianWaiting })).toMatchObject({
      kind: "collect",
    });
  });

  it("lets a chosen company beat the glossary, and knows whether it is collected", () => {
    expect(read("What is gross profit?", { mentioned: apple, ready: [apple] })).toEqual({
      kind: "ask",
      company: appleReady,
    });
    expect(read("Rivian", { mentioned: rivian, ready: [apple] })).toEqual({
      kind: "collect",
      company: rivianWaiting,
    });
  });

  it("decides nothing while the company lookup is still running", () => {
    expect(read("Apple", { isFetching: true })).toBeNull();
    expect(read("Apple", { named: appleReady, isFetching: true })).toMatchObject({
      kind: "screen",
    });
    expect(read("Rivian", { named: rivianWaiting, isFetching: true })).toMatchObject({
      kind: "collect",
    });
  });

  it("decides nothing for an empty box, and says so for words it cannot place", () => {
    expect(read("   ", { isFetching: true })).toBeNull();
    expect(read("hello there")).toEqual({ kind: "nothing" });
  });
});

describe("the pieces of reading", () => {
  it("finds the longest glossary term named, in the plural too, never inside another word", () => {
    expect(termIn("Apple share buybacks")?.name).toBe("Share buyback");
    expect(termIn("Apple's balance sheet")?.name).toBe("Balance sheet");
    expect(termIn("cashew nuts")).toBeNull();
  });

  it("asks for a meaning only when a term is named and the text starts like one", () => {
    expect(wordsOf("What is gross profit?").asksMeaning).toBe(true);
    expect(wordsOf("What is Apple?").asksMeaning).toBe(false);
    expect(wordsOf("Apple gross profit")).toMatchObject({
      term: { name: "Gross profit" },
      asksMeaning: false,
    });
  });

  it("takes a chosen company over a found one, and ignores a found one when asking a meaning", () => {
    expect(companyOf(undefined, [], appleReady, false, "Apple")).toBe(appleReady);
    expect(companyOf(undefined, [], appleReady, true, "What is gross profit?")).toBeNull();
    expect(companyOf(undefined, [], appleReady, false, "")).toBeNull();
    expect(companyOf(undefined, [], undefined, false, "Apple")).toBeNull();
    expect(companyOf(apple, [apple], null, false, "Apple")?.state).toBe("ready");
    expect(companyOf(apple, [], null, false, "Apple")?.state).toBe("not_collected");
  });

  it("knows a question by its mark or its first word", () => {
    expect(isQuestion("Apple growing?")).toBe(true);
    expect(isQuestion("Is Apple growing")).toBe(true);
    expect(isQuestion("Apple is growing")).toBe(false);
    expect(isQuestion("Whatever Apple does")).toBe(false);
  });

  it("takes the first year from 2000 to 2049 and ignores other numbers", () => {
    expect(yearIn("Apple in 2020 and 2021")).toBe(2020);
    expect(yearIn("Apple in 2050")).toBeNull();
    expect(yearIn("Apple in 1999")).toBeNull();
    expect(yearIn("Apple 12020")).toBeNull();
  });

  it("picks a statements tab from the words or from the term's section", () => {
    expect(screenFor("Apple debt", null)).toEqual({
      screen: "statements",
      label: "the statements",
      tab: "balance",
    });
    expect(screenFor("balance sheet and cash flow", null)).toMatchObject({
      tab: "cash",
    });
    expect(screenFor("Apple statement", null)).toEqual({
      screen: "statements",
      label: "the statements",
    });
    expect(screenFor("Apple inventory", termIn("Apple inventory"))).toMatchObject({
      tab: "balance",
    });
    expect(
      screenFor(
        "Apple depreciation and amortization",
        termIn("Apple depreciation and amortization"),
      ),
    ).toMatchObject({ tab: "cash" });
  });
});
