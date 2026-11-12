import { Layer, ManagedRuntime } from "effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import { Collect } from "./collect";
import { Collector } from "./collector";
import { Companies } from "./companies";
import { CoverageCheck } from "./coverage";
import { databaseLayer } from "./database";
import { Economy } from "./economy";
import { ReportedNumbers } from "./reported-numbers";
import { Sec } from "./sec";
import { Settings } from "./settings";

const live = Layer.mergeAll(Collector.layer, Companies.layer, Economy.layer).pipe(
  Layer.provideMerge(Layer.mergeAll(Collect.layer, CoverageCheck.layer)),
  Layer.provideMerge(ReportedNumbers.layer),
  Layer.provideMerge(Sec.layer),
  Layer.provideMerge(Settings.layer),
  Layer.provideMerge(databaseLayer()),
  Layer.provideMerge(FetchHttpClient.layer),
);

export const runtime = ManagedRuntime.make(live);
