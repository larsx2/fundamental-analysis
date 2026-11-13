import type { CompanyMatch } from "../functions/companies";
import { termWords } from "./ask/named-company";
import { plainName, shortName } from "./logo-tile";
import type { Mention } from "./mention-input";

export type Word = {
  readonly node: Text;
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly first: boolean;
};

export type Offer = Mention & {
  readonly ready: boolean;
  readonly exact: boolean;
};

type Kind = "upper" | "capital" | "lower";

const shownOffers = 6;
const glossaryWords = new Set(termWords);

export const kindOf = (word: Word): Kind =>
  /^[A-Z]{2,5}$/.test(word.text)
    ? "upper"
    : /^[A-Z]/.test(word.text) && !word.first
      ? "capital"
      : "lower";

export const worthOffering = (word: Word, kind: Kind) =>
  kind === "upper" ||
  (word.text.length >= 3 && (kind === "capital" || !glossaryWords.has(word.text.toLowerCase())));

const offerFrom = (
  company: Mention & { readonly tickers: ReadonlyArray<string> },
  word: string,
  kind: Kind,
  ready: boolean,
): Offer | null => {
  const exactTicker = kind === "upper" ? company.tickers.find((each) => each === word) : undefined;
  if (exactTicker !== undefined)
    return {
      cik: company.cik,
      ticker: exactTicker,
      name: company.name,
      ready,
      exact: true,
    };
  const lower = word.toLowerCase();
  const byName =
    shortName(company.name).toLowerCase().startsWith(lower) ||
    plainName(company.name).toLowerCase().startsWith(lower);
  const byTicker =
    kind === "upper" && word.length >= 3 && company.tickers.some((each) => each.startsWith(word));
  if (!byName && !byTicker) return null;
  return {
    cik: company.cik,
    ticker: company.tickers[0] ?? company.ticker,
    name: company.name,
    ready,
    exact: false,
  };
};

export const offersFor = (
  word: Word,
  ready: ReadonlyArray<Mention>,
  found: ReadonlyArray<CompanyMatch>,
): Array<Offer> => {
  const kind = kindOf(word);
  if (!worthOffering(word, kind)) return [];
  const own = ready.flatMap((company) => {
    const offer = offerFrom({ ...company, tickers: [company.ticker] }, word.text, kind, true);
    return offer === null ? [] : [offer];
  });
  // An everyday word in lower case only names a company already collected.
  if (kind === "lower" && own.length === 0) return [];
  const known = new Set(own.map((offer) => offer.cik));
  const others = found.flatMap((match) => {
    if (known.has(match.cik)) return [];
    known.add(match.cik);
    const offer = offerFrom(
      {
        cik: match.cik,
        name: match.name,
        ticker: match.tickers[0] ?? "",
        tickers: match.tickers,
      },
      word.text,
      kind,
      match.state === "ready",
    );
    return offer === null ? [] : [offer];
  });
  const all = [...own, ...others];
  return [...all.filter((offer) => offer.exact), ...all.filter((offer) => !offer.exact)].slice(
    0,
    shownOffers,
  );
};

export const certainOf = (word: Word, offers: ReadonlyArray<Offer>) => {
  const exact = offers.find((offer) => offer.exact);
  if (exact !== undefined && (word.text.length >= 3 || exact.ready)) return exact;
  const ready = offers.filter((offer) => offer.ready);
  const whole = ready.filter(
    (offer) => shortName(offer.name).toLowerCase().split(" ")[0] === word.text.toLowerCase(),
  );
  if (whole.length === 1 && ready.length === 1) return whole[0];
  return offers.length === 1 ? offers[0] : undefined;
};

export const sameMentions = (a: ReadonlyArray<Mention>, b: ReadonlyArray<Mention>) =>
  a.length === b.length && a.every((mention, index) => mention.cik === b[index]?.cik);
