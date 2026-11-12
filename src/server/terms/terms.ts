import { Effect } from "effect";
import { ReportedNumbers } from "../reported-numbers";
import { chooseTerms } from "./choose-terms";

export const termTableFor = (cik: number) =>
  Effect.gen(function* () {
    const reported = yield* ReportedNumbers;
    return chooseTerms(yield* reported.yearlyDollarAmounts(cik));
  });
