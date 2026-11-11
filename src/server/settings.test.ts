import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { databaseLayer } from "./database";
import { Settings } from "./settings";

// The tests below share one database in memory, built by the same layer the
// tool uses, so the table changes are exercised too.
const testLayer = Settings.layer.pipe(Layer.provideMerge(databaseLayer(":memory:")));

describe("Settings", () => {
  layer(testLayer)((it) => {
    // Catches: a setting that was never written coming back as an empty
    // string, which would look like a contact the person chose to leave blank.
    it.effect("a setting never written is absent", () =>
      Effect.gen(function* () {
        const settings = yield* Settings;
        expect(yield* settings.get("never-written")).toEqual(Option.none());
      }),
    );

    // Catches: a plain insert, which fails the second time a person
    // changes a setting, or keeps the old value.
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
