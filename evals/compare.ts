import { gradeFile } from "./score";

// Usage: bun evals/compare.ts before=a.json,b.json after=c.json,d.json
const groups = process.argv.slice(2).map((argument) => {
  const [label, files] = argument.split("=") as [string, string];
  return { label, files: files.split(",") };
});

const graded = await Promise.all(
  groups.map(async (group) => ({
    label: group.label,
    runs: await Promise.all(group.files.map((file) => gradeFile(file))),
  })),
);

const ids = [
  ...new Set(graded.flatMap((group) => group.runs.flat().map((each) => each.id))),
].sort();
const rightIn = (runs: (typeof graded)[number]["runs"], id: string) =>
  runs.filter((run) => run.find((each) => each.id === id)?.right === true).length;

console.log(
  ["question", ...graded.map((group) => `${group.label} (of ${group.runs.length})`)].join(" | "),
);
for (const id of ids) {
  const counts = graded.map((group) => rightIn(group.runs, id));
  if (new Set(counts.map((count, index) => count / graded[index]!.runs.length)).size > 1) {
    console.log([id, ...counts].join(" | "));
  }
}
const median = (values: ReadonlyArray<number | null>) => {
  const known = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
  return known.length === 0 ? "unknown" : String(known[Math.floor(known.length / 2)]);
};

for (const group of graded) {
  const totals = group.runs.map((run) => run.filter((each) => each.right).length);
  const answers = group.runs.flat();
  const text = answers.filter((each) => /-1[567]$/.test(each.id));
  console.log(
    `${group.label}: right ${totals.join(", ")} of ${group.runs[0]?.length ?? 0}; ` +
      `median ${median(answers.map((each) => each.seconds))}s, slowest ${median([Math.max(...answers.map((each) => each.seconds))])}s; ` +
      `text questions: median ${median(text.map((each) => each.seconds))}s, ${median(text.map((each) => each.trips))} trips, ${median(text.map((each) => each.inputTokens))} input tokens`,
  );
}
