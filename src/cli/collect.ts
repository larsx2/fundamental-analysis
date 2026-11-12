import { BunRuntime, BunServices } from "@effect/platform-bun";
import { Console, Effect, Layer } from "effect";
import { Argument, Command } from "effect/cli";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import { Collect } from "../server/collect";
import { Companies } from "../server/companies";
import { databaseLayer } from "../server/database";
import { ReportedNumbers } from "../server/reported-numbers";
import { Sec } from "../server/sec";
import { Settings } from "../server/settings";
import { termTableFor } from "../server/terms/terms";
import { printTerms } from "./print-terms";

const findByTicker = (ticker: string) =>
  Effect.gen(function* () {
    const companies = yield* Companies;
    const find = companies
      .search(ticker, 5)
      .pipe(Effect.map((matches) => matches.find((company) => company.tickers.includes(ticker))));
    const found = yield* find;
    if (found !== undefined) return found;
    yield* companies.refreshList;
    return yield* find;
  });

const collect = Command.make("collect", { ticker: Argument.String("ticker") }, ({ ticker }) =>
  Effect.gen(function* () {
    const wanted = ticker.toUpperCase();
    const company = yield* findByTicker(wanted);
    if (company === undefined) {
      yield* Console.error(`No public company has the ticker ${wanted}.`);
      return;
    }
    const report = yield* (yield* Collect).reportedNumbers(company.cik);
    const table = yield* termTableFor(company.cik);
    yield* Console.log(printTerms(`${company.name} (${wanted})`, table, report).join("\n"));
  }),
);

const services = Layer.mergeAll(Collect.layer, Companies.layer).pipe(
  Layer.provideMerge(ReportedNumbers.layer),
  Layer.provideMerge(Sec.layer),
  Layer.provideMerge(Settings.layer),
  Layer.provideMerge(databaseLayer()),
  Layer.provideMerge(FetchHttpClient.layer),
  Layer.provideMerge(BunServices.layer),
);

Command.run(collect, { version: "0.0.0" }).pipe(Effect.provide(services), BunRuntime.runMain);
