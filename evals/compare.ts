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
for (const group of graded) {
  const totals = group.runs.map((run) => run.filter((each) => each.right).length);
  const seconds = group.runs
    .flat()
    .map((each) => each.seconds)
    .sort((a, b) => a - b);
  console.log(
    `${group.label}: right ${totals.join(", ")} of ${group.runs[0]?.length ?? 0}; median ${seconds[Math.floor(seconds.length / 2)] ?? 0}s, slowest ${seconds.at(-1) ?? 0}s`,
  );
}
