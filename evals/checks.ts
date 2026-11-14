import { figuresOf, splitFigures } from "../src/shared/answer-figures";
import type { AskOutput } from "./harness";

export type Check = {
  readonly name: string;
  readonly pass: (output: AskOutput) => boolean;
};

const text = (output: AskOutput) =>
  output.answer === null ? "" : [output.answer.lead, ...output.answer.sentences].join(" ");

const lead = (output: AskOutput) => output.answer?.lead ?? "";

const scale: Readonly<Record<string, number>> = {
  trillion: 1e12,
  billion: 1e9,
  million: 1e6,
  thousand: 1e3,
};

export const amountsIn = (words: string) =>
  [
    ...words.matchAll(/([+−-])?\$\s?(\d[\d,]*(?:\.\d+)?)\s*(trillion|billion|million|thousand)?/gi),
  ].map(
    (match) =>
      (match[1] === "−" || match[1] === "-" ? -1 : 1) *
      Number(match[2]!.replace(/,/g, "")) *
      (scale[(match[3] ?? "").toLowerCase()] ?? 1),
  );

export const percentsIn = (words: string) =>
  [...words.matchAll(/([+−-]?\d+(?:\.\d+)?)\s?%/g)].map((match) =>
    Number(match[1]!.replace("−", "-")),
  );

export const centsIn = (words: string) =>
  [...words.matchAll(/(\d+)\s?¢/g)].map((match) => Number(match[1]));

export const states = (label: string, dollars: number, within = 0.006): Check => ({
  name: `states ${label}`,
  pass: (output) =>
    amountsIn(text(output)).some(
      (value) => Math.abs(value - dollars) <= Math.max(Math.abs(dollars) * within, 0.5e6),
    ),
});

export const statesPercent = (label: string, percent: number): Check => ({
  name: `states ${label}`,
  pass: (output) =>
    percentsIn(text(output)).some((value) => Math.abs(Math.abs(value) - Math.abs(percent)) <= 0.15),
});

export const statesCents = (label: string, cents: number): Check => ({
  name: `states ${label}`,
  pass: (output) => centsIn(text(output)).includes(cents),
});

export const says = (label: string, pattern: RegExp): Check => ({
  name: `says ${label}`,
  pass: (output) => pattern.test(text(output)),
});

export const saysNot = (label: string, pattern: RegExp): Check => ({
  name: `does not say ${label}`,
  pass: (output) => !pattern.test(text(output)),
});

const cannot =
  /\b(cannot|can['’]t|can ?not|does not (collect|hold|say|give|show|include|report|provide)|doesn['’]t|not collect|no (figure|record|count))/i;

export const saysItCannot: Check = {
  name: "says the tool or report cannot answer",
  pass: (output) => cannot.test(lead(output)),
};

export const answers: Check = {
  name: "answers instead of saying it cannot",
  pass: (output) => output.answer !== null && !cannot.test(lead(output)),
};

export const atLeast = (count: number, label: string, patterns: ReadonlyArray<RegExp>): Check => ({
  name: `names at least ${count} of ${label}`,
  pass: (output) => patterns.filter((pattern) => pattern.test(text(output))).length >= count,
});

export const noFiguresAdded: Check = {
  name: "adds no unrelated figures to a can't-answer",
  pass: (output) =>
    !cannot.test(lead(output)) ||
    (amountsIn(text(output)).length === 0 && percentsIn(text(output)).length === 0),
};

export const saysInLead = (label: string, pattern: RegExp): Check => ({
  name: `says ${label} first`,
  pass: (output) => pattern.test(lead(output)),
});

const judgement =
  /\b(impressive|attractive|healthy|solid|excellent|undervalued|overvalued|cheap|expensive|a good|a bad|should (buy|sell)|(strong|weak|poor) (balance sheet|position|business|company|performance|results|investment))\b/i;

export const neutral: Check = {
  name: "passes no judgement",
  pass: (output) => !judgement.test(text(output)),
};

export const onlyLookedUpNumbers: Check = {
  name: "every number came from a lookup",
  pass: (output) => {
    const known = output.reads.flatMap((read) =>
      figuresOf({ lookup: read.lookup, figures: read.figures ?? {} }).map((figure) => ({
        text: figure,
        source: read.lookup,
      })),
    );
    return splitFigures(text(output), known).every((piece) => piece.kind !== "unchecked");
  },
};

export const anyOf = (name: string, ...checks: ReadonlyArray<Check>): Check => ({
  name,
  pass: (output) => checks.some((check) => check.pass(output)),
});

export const showsAPassage: Check = {
  name: "shows a passage of the annual report",
  pass: (output) => (output.answer?.quotes ?? []).length > 0,
};

export const answered: Check = {
  name: "returns an answer",
  pass: (output) => output.answer !== null && output.failure === null,
};

export const always: ReadonlyArray<Check> = [answered, neutral, onlyLookedUpNumbers];
