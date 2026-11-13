import { describe, expect, layer } from "@effect/vitest";
import { Effect, Layer, Option } from "effect";
import { databaseLayer } from "./database";
import { contactFromEnv, contactOf, contactText, secContactText, Settings } from "./settings";

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

    it("reads the SEC contact from the environment when none is stored", () => {
      const env = { SEC_CONTACT_NAME: "Ada Lovelace", SEC_CONTACT_EMAIL: "ada@example.com" };
      expect(contactFromEnv(env)).toEqual(
        Option.some({ name: "Ada Lovelace", email: "ada@example.com" }),
      );
      expect(secContactText(Option.none(), env)).toEqual(
        Option.some("Ada Lovelace ada@example.com"),
      );
    });

    it("prefers the contact given in the dialog", () => {
      const env = { SEC_CONTACT_NAME: "Ada Lovelace", SEC_CONTACT_EMAIL: "ada@example.com" };
      expect(secContactText(Option.some("Grace Hopper grace@example.com"), env)).toEqual(
        Option.some("Grace Hopper grace@example.com"),
      );
    });

    it("has no contact when neither the environment nor the dialog gives one", () => {
      expect(contactFromEnv({})).toEqual(Option.none());
      expect(secContactText(Option.none(), {})).toEqual(Option.none());
    });

    it("refuses half a contact from the environment", () => {
      expect(() => contactFromEnv({ SEC_CONTACT_NAME: "Ada Lovelace" })).toThrow(
        "Set both SEC_CONTACT_NAME and SEC_CONTACT_EMAIL, or neither.",
      );
      expect(() => contactFromEnv({ SEC_CONTACT_EMAIL: "ada@example.com" })).toThrow(
        "Set both SEC_CONTACT_NAME and SEC_CONTACT_EMAIL, or neither.",
      );
    });

    it("keeps a name with several words together", () => {
      const contact = { name: "Ada King Lovelace", email: "ada@example.com" };
      expect(contactOf(contactText(contact))).toEqual(contact);
    });
  });
});
