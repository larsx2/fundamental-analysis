import { Effect } from "effect";
import type { LookupResult } from "../../shared/lookups";
import { companyDetails, findCompany } from "../company-view";
import { Economy } from "../economy";
import { glossaryLookup, LookupProblem, runLookup } from "./lookups";

export type LookupReply = { readonly result: LookupResult } | { readonly error: string };

const attempt = (run: () => LookupResult) =>
  Effect.try({
    try: run,
    catch: (cause) =>
      cause instanceof LookupProblem
        ? cause
        : new LookupProblem({ message: `The lookup failed: ${String(cause)}` }),
  }).pipe(
    Effect.map((result): LookupReply => ({ result })),
    Effect.catch((problem) => Effect.succeed<LookupReply>({ error: problem.message })),
  );

export const lookUp = (name: string, input: unknown) =>
  Effect.gen(function* () {
    const args =
      typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
    if (name === "glossary") return yield* attempt(() => glossaryLookup(String(args.term ?? "")));
    const ticker = String(args.ticker ?? "").trim();
    const row = yield* findCompany(ticker);
    if (row === null) {
      return {
        error: `No public company has the ticker ${ticker}.`,
      } satisfies LookupReply;
    }
    if (row.state !== "ready") {
      return {
        error: `${row.name} is not collected yet, so the tool holds none of its figures.`,
      } satisfies LookupReply;
    }
    const details = yield* companyDetails(row);
    const months =
      name === "context" || args.economy === true ? (yield* (yield* Economy).months).months : [];
    return yield* attempt(() =>
      runLookup(
        {
          cik: row.cik,
          name: row.name,
          ticker: row.ticker ?? ticker.toUpperCase(),
          years: details.years,
          events: details.events,
          description: details.description,
          months,
        },
        name,
        args,
      ),
    );
  });
