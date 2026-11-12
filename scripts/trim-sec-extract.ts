import { readFileSync, writeFileSync } from "node:fs";
import { statementTags } from "../src/server/terms/statement-tags";
import { partTags, partialTags, termTags } from "../src/server/terms/term-tags";

const [input, output] = process.argv.slice(2);
if (input === undefined || output === undefined) {
  console.error("Usage: bun scripts/trim-sec-extract.ts <companyfacts.json> <extract.json>");
  process.exit(1);
}

type Entry = { readonly form?: string };
type Facts = {
  readonly cik: number;
  readonly entityName: string;
  readonly facts: Record<string, Record<string, { readonly units: Record<string, Array<Entry>> }>>;
};

const keep = new Set([
  ...Object.values(termTags).flat(),
  ...Object.values(partTags).flat(),
  ...partialTags,
  ...statementTags,
]);

const full: Facts = JSON.parse(readFileSync(input, "utf8"));
const usGaap = full.facts["us-gaap"] ?? {};
const trimmed = Object.fromEntries(
  Object.entries(usGaap)
    .filter(([tag]) => keep.has(tag))
    .map(([tag, { units }]) => [
      tag,
      {
        units: Object.fromEntries(
          Object.entries(units).map(([unit, entries]) => [
            unit,
            entries.filter((entry) => entry.form === "10-K"),
          ]),
        ),
      },
    ]),
);

writeFileSync(
  output,
  `${JSON.stringify({ cik: full.cik, entityName: full.entityName, facts: { "us-gaap": trimmed } })}\n`,
);
console.log(`${output}: ${Object.keys(trimmed).length} tags`);
