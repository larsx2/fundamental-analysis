import { Layer, ManagedRuntime } from "effect";
import { databaseLayer } from "./database";
import { Settings } from "./settings";

// Everything the server's Effect programs may ask for, built once.
const live = Settings.layer.pipe(Layer.provideMerge(databaseLayer()));

/**
 * The one place where Effect programs are turned into plain promises.
 *
 * Screens never see Effect. A server function hands its program to
 * `runtime.runPromise`, which runs it with the services above and returns
 * an ordinary promise. A failure becomes a rejected promise, so it reaches
 * the screen like any other error.
 *
 * The runtime opens the database on first use and keeps it open while the
 * server runs.
 */
export const runtime = ManagedRuntime.make(live);
