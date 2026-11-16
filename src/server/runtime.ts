import { BunServices } from "@effect/platform-bun";
import { Layer, ManagedRuntime } from "effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import { Agent } from "./agent/agent";
import { Collect } from "./collect";
import { Collector } from "./collector";
import { Companies } from "./companies";
import { CoverageCheck } from "./coverage";
import { databaseLayer } from "./database";
import { Economy } from "./economy";
import { Logos } from "./logos";
import { ReportedNumbers } from "./reported-numbers";
import { Sec } from "./sec";
import { Settings } from "./settings";

const live = Layer.mergeAll(
  Collector.layer,
  Companies.layer,
  Economy.layer,
  Agent.layer.pipe(Layer.provide(BunServices.layer)),
).pipe(
  Layer.provideMerge(Layer.mergeAll(Collect.layer, CoverageCheck.layer, Logos.layer)),
  Layer.provideMerge(ReportedNumbers.layer),
  Layer.provideMerge(Sec.layer),
  Layer.provideMerge(Settings.layer),
  Layer.provideMerge(databaseLayer()),
  Layer.provideMerge(FetchHttpClient.layer),
);

export const runtime = ManagedRuntime.make(live);

// The dev server loads this file again after each change, and the runtime it
// replaces would keep its Codex running. Each runtime stops the one before it.
const shared = globalThis as typeof globalThis & { runtime?: typeof runtime };
void shared.runtime?.dispose();
shared.runtime = runtime;
