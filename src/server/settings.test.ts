import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { databaseLayer } from "./database";
import { Settings } from "./settings";

const testLayer = Settings.layer.pipe(Layer.provideMerge(databaseLayer(":memory:")));

describe("Settings", () => {
  layer(testLayer)((it) => {
    it.effect("a setting never written is absent", () =>
      Effect.gen(function* () {
        const settings = yield* Settings;
        expect(yield* settings.get("never-written")).toEqual(Option.none());
      }),
    );

    it.effect("writing a setting twice keeps the latest value", () =>
      Effect.gen(function* () {
        const settings = yield* Settings;
        yield* settings.set("contact", "first@example.com");
        yield* settings.set("contact", "second@example.com");
        expect(yield* settings.get("contact")).toEqual(Option.some("second@example.com"));
      }),
    );
  });
});
