import { Effect } from "effect";
import { ReportedNumbers } from "../reported-numbers";
import { chooseTerms } from "./choose-terms";
import { chooseStatements } from "./statements";

export const termTableFor = (cik: number) =>
  Effect.gen(function* () {
    const reported = yield* ReportedNumbers;
    return chooseTerms(yield* reported.yearlyDollarAmounts(cik));
  });

export const statementsFor = (cik: number) =>
  Effect.gen(function* () {
    const reported = yield* ReportedNumbers;
    const [durations, instants, perShare] = yield* Effect.all([
      reported.yearlyDollarAmounts(cik),
      reported.balances(cik),
      reported.yearlyPerShareAmounts(cik),
    ]);
    return chooseStatements({ durations, instants, perShare });
  });
