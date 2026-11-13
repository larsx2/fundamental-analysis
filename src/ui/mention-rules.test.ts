import { describe, expect, it } from "vitest";
import type { CompanyMatch } from "../functions/companies";
import {
  certainOf,
  kindOf,
  type Offer,
  offersFor,
  sameMentions,
  type Word,
  worthOffering,
} from "./mention-rules";

const word = (text: string, first = false): Word => ({
  node: {} as Text,
  start: 0,
  end: text.length,
  text,
  first,
});

const apple = { cik: 320193, ticker: "AAPL", name: "Apple Inc." };
const microsoft = { cik: 789019, ticker: "MSFT", name: "MICROSOFT CORP" };

const match = (
  company: { cik: number; ticker: string; name: string },
  state: CompanyMatch["state"] = "not_collected",
  tickers: ReadonlyArray<string> = [company.ticker],
): CompanyMatch => ({ cik: company.cik, name: company.name, tickers, state });

const offer = (
  company: { cik: number; ticker: string; name: string },
  ready: boolean,
  exact: boolean,
): Offer => ({ ...company, ready, exact });

describe("what kind of word was typed", () => {
  it("calls two to five capitals a ticker", () => {
    expect(kindOf(word("AAPL"))).toBe("upper");
    expect(kindOf(word("GE", true))).toBe("upper");
    expect(kindOf(word("ABCDEF"))).toBe("capital");
  });

  it("calls a capital in the middle of a sentence a name, and the sentence's first word everyday", () => {
    expect(kindOf(word("Apple"))).toBe("capital");
    expect(kindOf(word("Apple", true))).toBe("lower");
    expect(kindOf(word("apple"))).toBe("lower");
  });
});

describe("whether a word is worth looking up", () => {
  it("always looks up a ticker, even a short one", () => {
    expect(worthOffering(word("GE"), "upper")).toBe(true);
  });

  it("skips words under three letters that are not tickers", () => {
    expect(worthOffering(word("ap"), "lower")).toBe(false);
    expect(worthOffering(word("Ap"), "capital")).toBe(false);
  });

  it("never looks up a glossary word in lower case", () => {
    expect(worthOffering(word("revenue"), "lower")).toBe(false);
    expect(worthOffering(word("net"), "lower")).toBe(false);
    expect(worthOffering(word("micro"), "lower")).toBe(true);
  });

  it("looks up a glossary word written with a capital, since it may be a name", () => {
    expect(worthOffering(word("Revenue"), "capital")).toBe(true);
  });
});

describe("which companies a word is offered for", () => {
  it("offers a company by an exact ticker in capitals, even one not collected", () => {
    expect(offersFor(word("AAPL"), [], [match(apple)])).toEqual([offer(apple, false, true)]);
  });

  it("marks an exact ticker ready when the company is already collected", () => {
    expect(offersFor(word("AAPL"), [], [match(apple, "ready")])).toEqual([
      offer(apple, true, true),
    ]);
  });

  it("offers the start of a ticker of three letters or more, but not an exact match", () => {
    expect(offersFor(word("MSF"), [], [match(microsoft)])).toEqual([
      offer(microsoft, false, false),
    ]);
    expect(offersFor(word("MS"), [], [match(microsoft)])).toEqual([]);
  });

  it("offers a name that starts with a capitalised word", () => {
    expect(offersFor(word("Micro"), [], [match(microsoft)])).toEqual([
      offer(microsoft, false, false),
    ]);
  });

  it("offers nothing for a word that starts no name and no ticker", () => {
    expect(offersFor(word("Zebra"), [], [match(apple), match(microsoft)])).toEqual([]);
  });

  it("puts the exact ticker before longer tickers that only start with it", () => {
    const longer = { cik: 1, ticker: "ABCD", name: "Alpha Beta Corp" };
    const exact = { cik: 2, ticker: "ABC", name: "Abc Industries" };
    expect(offersFor(word("ABC"), [], [match(longer), match(exact)])).toEqual([
      offer(exact, false, true),
      { ...longer, ready: false, exact: false },
    ]);
  });

  it("offers a lower-case everyday word only for companies already collected", () => {
    expect(offersFor(word("micro"), [], [match(microsoft)])).toEqual([]);
    expect(offersFor(word("micro"), [apple], [match(microsoft)])).toEqual([]);
    expect(offersFor(word("micro"), [microsoft], [])).toEqual([offer(microsoft, true, false)]);
  });

  it("adds other matches beside the collected ones once a collected company matches", () => {
    const microchip = {
      cik: 827054,
      ticker: "MCHP",
      name: "Microchip Technology Inc",
    };
    expect(offersFor(word("micro"), [microsoft], [match(microchip, "ready")])).toEqual([
      offer(microsoft, true, false),
      offer(microchip, true, false),
    ]);
  });

  it("offers a collected company once even when the search finds it too", () => {
    expect(offersFor(word("Micro"), [microsoft], [match(microsoft, "ready")])).toEqual([
      offer(microsoft, true, false),
    ]);
  });

  it("offers a first word at the start of a sentence like any everyday word", () => {
    expect(offersFor(word("Micro", true), [], [match(microsoft)])).toEqual([]);
    expect(offersFor(word("Micro", true), [microsoft], [])).toEqual([
      offer(microsoft, true, false),
    ]);
  });

  it("never offers a glossary word in lower case, even for a collected company", () => {
    const revenue = { cik: 5, ticker: "RVNU", name: "Revenue Corp" };
    expect(offersFor(word("revenue"), [revenue], [match(revenue, "ready")])).toEqual([]);
    expect(offersFor(word("Revenue"), [revenue], [])).toEqual([offer(revenue, true, false)]);
  });

  it("names the first listed ticker when a company has several", () => {
    const alphabet = { cik: 1652044, ticker: "GOOGL", name: "Alphabet Inc." };
    expect(offersFor(word("Alpha"), [], [match(alphabet, "ready", ["GOOGL", "GOOG"])])).toEqual([
      offer(alphabet, true, false),
    ]);
    expect(offersFor(word("GOOG"), [], [match(alphabet, "ready", ["GOOGL", "GOOG"])])).toEqual([
      { ...alphabet, ticker: "GOOG", ready: true, exact: true },
    ]);
  });

  it("shows at most six offers", () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      match({
        cik: 100 + index,
        ticker: `AB${index}`,
        name: `Alpha ${index} Inc.`,
      }),
    );
    expect(offersFor(word("Alpha"), [], many)).toHaveLength(6);
  });
});

describe("when a typed word becomes a chip on its own", () => {
  const exactApple = offer(apple, false, true);
  const readyMicrosoft = offer(microsoft, true, false);
  const otherMicrosoft = offer(
    { cik: 2, ticker: "MSRH", name: "Microsoft Research Ltd" },
    false,
    false,
  );

  it("takes an exact ticker of three letters or more", () => {
    expect(certainOf(word("AAPL"), [exactApple, otherMicrosoft])).toBe(exactApple);
  });

  it("takes a two-letter ticker only when the company is collected", () => {
    const general = { cik: 40545, ticker: "GE", name: "General Electric Co" };
    const other = offer({ cik: 3, ticker: "GEHC", name: "GE Healthcare" }, false, false);
    expect(certainOf(word("GE"), [offer(general, false, true), other])).toBeUndefined();
    const collected = offer(general, true, true);
    expect(certainOf(word("GE"), [collected, other])).toBe(collected);
  });

  it("takes a whole first word that has one ready match", () => {
    expect(certainOf(word("Microsoft"), [readyMicrosoft, otherMicrosoft])).toBe(readyMicrosoft);
    expect(certainOf(word("microsoft", true), [readyMicrosoft, otherMicrosoft])).toBe(
      readyMicrosoft,
    );
  });

  it("waits when only the start of a name was typed", () => {
    expect(certainOf(word("Micro"), [readyMicrosoft, otherMicrosoft])).toBeUndefined();
  });

  it("waits when two ready companies share the whole first word", () => {
    const readyResearch = { ...otherMicrosoft, ready: true };
    expect(certainOf(word("Microsoft"), [readyMicrosoft, readyResearch])).toBeUndefined();
  });

  it("takes a lone offer even for part of a name", () => {
    expect(certainOf(word("Micro"), [otherMicrosoft])).toBe(otherMicrosoft);
  });

  it("takes nothing when there is nothing to take", () => {
    expect(certainOf(word("Micro"), [])).toBeUndefined();
  });
});

describe("whether two lists of chips are the same", () => {
  it("compares them by company number, in order", () => {
    expect(sameMentions([apple, microsoft], [apple, { ...microsoft, name: "Renamed" }])).toBe(true);
    expect(sameMentions([apple, microsoft], [microsoft, apple])).toBe(false);
    expect(sameMentions([apple], [apple, microsoft])).toBe(false);
    expect(sameMentions([], [])).toBe(true);
  });
});
