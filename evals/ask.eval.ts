import { createJudge, describeEval } from "vitest-evals";
import type { AskOutput } from "./harness";
import { appHarness } from "./harness";
import { casesFor, heldOut, type Case, tuning } from "./questions";
import { grade } from "./score";

const companies = process.env.EVAL_SET === "held-out" ? heldOut : tuning;
const only = (process.env.EVAL_ONLY ?? "").split(",").filter((each) => each !== "");
const cases = casesFor(companies).filter((each) => only.length === 0 || only.includes(each.id));

const answerKey = createJudge<Case, AskOutput>("Answer key", ({ input, output }) => {
  const result = grade(input.id, output);
  return {
    score: result.right ? 1 : 0,
    metadata: {
      rationale: result.right ? "Every check passed." : `Failed: ${result.failed.join("; ")}`,
    },
  };
});

describeEval(
  `Ask: ${process.env.EVAL_SET ?? "tuning"} companies`,
  { harness: appHarness, judges: [answerKey], judgeThreshold: 1 },
  (it) => {
    it.for(cases)("$id: $question", async (input, { run }) => {
      await run(input);
    });
  },
);
