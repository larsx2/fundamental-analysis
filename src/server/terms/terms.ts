import { Effect } from "effect";
import { ReportedNumbers } from "../reported-numbers";
import { chooseTerms } from "./choose-terms";
import { statementTags } from "./statement-tags";
import { chooseStatements } from "./statements";
import { partTags, termTags } from "./term-tags";

const usedTags = [
  ...Object.values(termTags).flat(),
  ...Object.values(partTags).flat(),
  ...statementTags,
];

export const termTableFor = (cik: number) =>
  Effect.gen(function* () {
    const reported = yield* ReportedNumbers;
    return chooseTerms(yield* reported.yearlyDollarAmounts(cik));
  });

export const statementsFor = (cik: number) =>
  Effect.gen(function* () {
    const reported = yield* ReportedNumbers;
    const [durations, instants, perShare] = yield* Effect.all([
      reported.yearlyDollarAmounts(cik, usedTags),
      reported.balances(cik, usedTags),
      reported.yearlyPerShareAmounts(cik, usedTags),
    ]);
    return chooseStatements({ durations, instants, perShare });
  });
