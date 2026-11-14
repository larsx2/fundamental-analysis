import { readFile } from "node:fs/promises";
import { always, type Check } from "./checks";
import type { AskOutput } from "./harness";
import { keyFor } from "./key";

export const grade = (id: string, output: AskOutput) => {
  const checks: ReadonlyArray<Check> = [...always, ...keyFor(id)];
  const failed = checks.filter((check) => !check.pass(output)).map((check) => check.name);
  return {
    id,
    right: failed.length === 0,
    failed,
    checks: checks.length,
    seconds: output.seconds,
  };
};

type Report = {
  readonly testResults: ReadonlyArray<{
    readonly assertionResults: ReadonlyArray<{
      readonly title: string;
      readonly meta: {
        readonly harness?: { readonly run?: { readonly output?: AskOutput } };
      };
    }>;
  }>;
};

export const gradeFile = async (file: string) => {
  const report = JSON.parse(await readFile(file, "utf8")) as Report;
  return report.testResults
    .flatMap((each) => each.assertionResults)
    .flatMap((test) => {
      const output = test.meta.harness?.run?.output;
      return output === undefined ? [] : [grade(test.title.split(":")[0]!, output)];
    })
    .sort((a, b) => a.id.localeCompare(b.id));
};

if (import.meta.main) {
  for (const file of process.argv.slice(2)) {
    const grades = await gradeFile(file);
    console.log(
      `\n${file}: ${grades.filter((each) => each.right).length} of ${grades.length} right`,
    );
    for (const each of grades.filter((g) => !g.right))
      console.log(`  ✗ ${each.id}: ${each.failed.join("; ")}`);
  }
}
