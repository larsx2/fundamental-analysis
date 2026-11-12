export type Question = {
  readonly key: string;
  readonly text: (name: string) => string;
  readonly missing?: string;
};

const textOfAnnualReport = "The text of the annual report is not collected yet";

export const questions: ReadonlyArray<Question> = [
  {
    key: "q1",
    text: (name) => `What does ${name} do, and how does it make money?`,
  },
  {
    key: "q2",
    text: (name) => `Which products or places does ${name}'s revenue come from?`,
    missing: "Segments are not collected yet",
  },
  { key: "q3", text: (name) => `Is ${name} growing?` },
  { key: "q4", text: (name) => `Has ${name}'s growth been steady?` },
  {
    key: "q5",
    text: (name) => `Where does each dollar of ${name}'s revenue go?`,
  },
  {
    key: "q6",
    text: (name) =>
      `Is anything left after ${name}'s costs, and are its margins rising or falling?`,
  },
  { key: "q7", text: (name) => `Does ${name}'s net income turn into cash?` },
  {
    key: "q8",
    text: (name) => `How much debt does ${name} have, and could it pay it back?`,
  },
  { key: "q9", text: (name) => `What does ${name} own, and what does it owe?` },
  { key: "q10", text: (name) => `What does ${name} do with its cash?` },
  {
    key: "q11",
    text: (name) => `Does ${name} pay a dividend, and has it grown?`,
  },
  {
    key: "q12",
    text: (name) => `Is ${name} buying back its shares or issuing more?`,
  },
  { key: "q13", text: (name) => `How much does ${name} spend on its future?` },
  {
    key: "q14",
    text: (name) => `How well does ${name} use the money put into it?`,
  },
  {
    key: "q15",
    text: (name) => `Who does ${name} compete with, and what is its competitive advantage?`,
    missing: textOfAnnualReport,
  },
  {
    key: "q16",
    text: (name) => `What are ${name}'s main risks?`,
    missing: textOfAnnualReport,
  },
  {
    key: "q17",
    text: (name) => `What does ${name} say about its year?`,
    missing: textOfAnnualReport,
  },
  { key: "q18", text: (name) => `What was happening around ${name}?` },
  {
    key: "q19",
    text: (name) => `How did ${name} do in the last recession, or when interest rates rose?`,
  },
  { key: "q20", text: (name) => `Can I trust ${name}'s numbers?` },
];

export const topics: ReadonlyArray<{
  readonly name: string;
  readonly key: string;
}> = [
  { name: "Growth", key: "q3" },
  { name: "Each dollar", key: "q5" },
  { name: "Cash", key: "q7" },
  { name: "Debt", key: "q8" },
  { name: "What happened", key: "q18" },
  { name: "Trust", key: "q20" },
];

const routes: ReadonlyArray<readonly [string, RegExp]> = [
  ["q12", /buy(ing)? back|buyback|repurchas|dilut|issu(e|es|ing) (more )?shares|stock-based/i],
  ["q2", /segment|which products|product line|revenue come from|regions?\b|countr/i],
  ["q15", /compet|moat|advantage|rival/i],
  ["q16", /risk/i],
  ["q17", /say about|outlook|guidance|management|discussion/i],
  ["q19", /recession|rates? (rose|rise|went up)|downturn|crisis/i],
  ["q18", /happen|around it|events?\b|economy|news|timeline/i],
  ["q20", /trust|accurate|reliable|restat|doubt|correct/i],
  ["q14", /return on|invested capital|efficient|money put into/i],
  ["q13", /future|research|invest(ing|s)? in|capital expenditure/i],
  ["q11", /dividend/i],
  ["q10", /do with (its )?(cash|money)|cash (go|used)|capital allocation|spend its cash/i],
  ["q9", /\bown\b|assets|liabilit|balance sheet|equity/i],
  ["q8", /debt|\bowe|borrow|pay (it )?back/i],
  ["q7", /cash flow|into cash|free cash|real cash/i],
  ["q6", /profit|margin|loss|left after/i],
  ["q5", /each dollar|money go|spend|spent|costs?\b/i],
  ["q4", /steady|consistent|bumpy|every year|volatil/i],
  ["q3", /grow/i],
  ["q1", /what does .+ do|make money|business model/i],
];

export const suggestionsFor = (typed: string, name: string, count = 4) => {
  const words = typed.trim().toLowerCase();
  if (words.length < 2) return [];
  const routed = routes.find(([, pattern]) => pattern.test(words))?.[0];
  return questions
    .filter(
      (question) => question.key === routed || question.text(name).toLowerCase().includes(words),
    )
    .sort((a, b) => Number(b.key === routed) - Number(a.key === routed))
    .slice(0, count);
};
