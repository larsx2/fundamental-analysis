import { Layer, ManagedRuntime } from "effect";
import { databaseLayer } from "./database";
import { Settings } from "./settings";

const live = Settings.layer.pipe(Layer.provideMerge(databaseLayer()));

export const runtime = ManagedRuntime.make(live);
