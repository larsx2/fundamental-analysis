export type Company = { readonly ticker: string; readonly name: string };

export const tuning: ReadonlyArray<Company> = [
  { ticker: "AAPL", name: "Apple" },
  { ticker: "COST", name: "Costco" },
  { ticker: "MSFT", name: "Microsoft" },
];

export const heldOut: ReadonlyArray<Company> = [
  { ticker: "NVDA", name: "NVIDIA" },
  { ticker: "NET", name: "Cloudflare" },
];

export type Kind = "twenty" | "unanswerable" | "false premise" | "follow-up" | "comparison";

export type Case = {
  readonly id: string;
  readonly kind: Kind;
  readonly number: number | null;
  readonly tickers: ReadonlyArray<string>;
  readonly question: string;
  readonly earlier: ReadonlyArray<{
    readonly question: string;
    readonly answer: string;
  }>;
};

const twenty: ReadonlyArray<(name: string) => string> = [
  (name) => `What does ${name} do, and how does it make money?`,
  (name) => `Which products or places does ${name}'s revenue come from?`,
  (name) => `Is ${name} growing?`,
  (name) => `Has ${name}'s growth been steady?`,
  (name) => `Where does each dollar of ${name}'s revenue go?`,
  (name) => `Is anything left after ${name}'s costs, and are its margins rising or falling?`,
  (name) => `Does ${name}'s net income turn into cash?`,
  (name) => `How much debt does ${name} have, and could it pay it back?`,
  (name) => `What does ${name} own, and what does it owe?`,
  (name) => `What does ${name} do with its cash?`,
  (name) => `Does ${name} pay a dividend, and has it grown?`,
  (name) => `Is ${name} buying back its shares or issuing more?`,
  (name) => `How much does ${name} spend on its future?`,
  (name) => `How well does ${name} use the money put into it?`,
  (name) => `Who does ${name} compete with, and what is its competitive advantage?`,
  (name) => `What are ${name}'s main risks?`,
  (name) => `What does ${name} say about its year?`,
  (name) => `What was happening around ${name}?`,
  (name) => `How did ${name} do in the last recession, or when interest rates rose?`,
  (name) => `Can I trust ${name}'s numbers?`,
];

const unanswerable: Readonly<Record<string, ReadonlyArray<string>>> = {
  AAPL: [
    "How many iPhones did Apple sell in fiscal 2026?",
    "How much does Apple pay Foxconn each year?",
  ],
  COST: ["How much is Costco's CEO paid?", "How many hot dogs does Costco sell each year?"],
  MSFT: ["How many Xbox consoles did Microsoft sell?", "How many people use Bing each day?"],
  NVDA: ["How many GPUs did NVIDIA ship last year?", "How much does NVIDIA pay TSMC each year?"],
  NET: ["How many websites use Cloudflare?", "How much does Cloudflare's CEO earn?"],
};

const falsePremise: Readonly<Record<string, string>> = {
  AAPL: "Why did Apple's revenue fall in fiscal 2026?",
  COST: "Why did Costco stop paying a dividend?",
  MSFT: "Why did Microsoft's net income drop in fiscal 2026?",
  NVDA: "Why did NVIDIA's revenue shrink last year?",
  NET: "Why is Cloudflare so profitable?",
};

const followUp: Readonly<Record<string, Case["earlier"][number] & { readonly next: string }>> = {
  AAPL: {
    question: "Is Apple growing?",
    answer: "Yes. Apple's revenue grew in its latest fiscal year.",
    next: "And the year before?",
  },
  COST: {
    question: "How much did Costco spend on capital expenditure?",
    answer: "Costco spent on new warehouses and equipment in its latest fiscal year.",
    next: "Is that more than it paid in dividends?",
  },
  MSFT: {
    question: "What are Microsoft's margins?",
    answer: "Microsoft keeps a large share of each dollar of revenue as operating income.",
    next: "Were they higher five years ago?",
  },
  NVDA: {
    question: "Is NVIDIA growing?",
    answer: "Yes. NVIDIA's revenue grew in its latest fiscal year.",
    next: "And the year before?",
  },
  NET: {
    question: "Does Cloudflare make a profit?",
    answer: "Cloudflare's net income was below zero in its latest fiscal year.",
    next: "Does it still bring in cash?",
  },
};

const comparisons: ReadonlyArray<Pick<Case, "id" | "tickers" | "question">> = [
  {
    id: "AAPL+MSFT-research",
    tickers: ["AAPL", "MSFT"],
    question: "Who spends more on research and development, Apple or Microsoft?",
  },
  {
    id: "COST+AAPL-margins",
    tickers: ["COST", "AAPL"],
    question: "Which keeps more of each dollar of revenue, Costco or Apple?",
  },
  {
    id: "NVDA+NET-size",
    tickers: ["NVDA", "NET"],
    question: "Which brings in more revenue, NVIDIA or Cloudflare?",
  },
];

export const casesFor = (companies: ReadonlyArray<Company>): ReadonlyArray<Case> => {
  const tickers = new Set(companies.map((company) => company.ticker));
  return [
    ...companies.flatMap((company) => [
      ...twenty.map((question, index): Case => ({
        id: `${company.ticker}-${String(index + 1).padStart(2, "0")}`,
        kind: "twenty",
        number: index + 1,
        tickers: [company.ticker],
        question: question(company.name),
        earlier: [],
      })),
      ...(unanswerable[company.ticker] ?? []).map((question, index): Case => ({
        id: `${company.ticker}-unanswerable-${index + 1}`,
        kind: "unanswerable",
        number: null,
        tickers: [company.ticker],
        question,
        earlier: [],
      })),
      {
        id: `${company.ticker}-false-premise`,
        kind: "false premise" as const,
        number: null,
        tickers: [company.ticker],
        question: falsePremise[company.ticker]!,
        earlier: [],
      },
      {
        id: `${company.ticker}-follow-up`,
        kind: "follow-up" as const,
        number: null,
        tickers: [company.ticker],
        question: followUp[company.ticker]!.next,
        earlier: [
          {
            question: followUp[company.ticker]!.question,
            answer: followUp[company.ticker]!.answer,
          },
        ],
      },
    ]),
    ...comparisons
      .filter((comparison) => comparison.tickers.every((ticker) => tickers.has(ticker)))
      .map((comparison): Case => ({
        ...comparison,
        kind: "comparison",
        number: null,
        earlier: [],
      })),
  ];
};
