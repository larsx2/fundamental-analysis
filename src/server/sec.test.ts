import { describe, expect, it } from "@effect/vitest";
import { Clock, Context, Effect, Exit, Fiber, Layer } from "effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import { TestClock } from "effect/testing";
import { databaseLayer } from "./database";
import { Sec } from "./sec";
import { Settings, secContactKey } from "./settings";

const url = "https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json";
const contact = "Test Person test@example.com";

type Seen = { at: number; userAgent: string | undefined };

const standIn = (seen: Array<Seen>, answer: (n: number) => number) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.gen(function* () {
        const status = answer(seen.length);
        seen.push({
          at: yield* Clock.currentTimeMillis,
          userAgent: request.headers["user-agent"],
        });
        return HttpClientResponse.fromWeb(
          request,
          new Response(JSON.stringify({ ok: true }), { status }),
        );
      }),
    ),
  );

const setup = (seen: Array<Seen>, answer: (n: number) => number, withContact = true) => {
  const services = Settings.layer.pipe(
    Layer.provideMerge(databaseLayer(":memory:")),
    Layer.merge(standIn(seen, answer)),
  );
  const giveContact = withContact
    ? Effect.gen(function* () {
        const settings = yield* Settings;
        yield* settings.set(secContactKey, contact);
      })
    : Effect.void;
  return { services, giveContact };
};

const runWithClock = <A, E>(program: Effect.Effect<A, E>) =>
  Effect.gen(function* () {
    const fiber = yield* Effect.forkChild(program);
    yield* TestClock.adjust("5 minutes");
    return yield* Fiber.await(fiber);
  });

describe("Sec", () => {
  it.effect("two copies sharing a database never send more than ten requests in any second", () => {
    const seen: Array<Seen> = [];
    const { services, giveContact } = setup(seen, () => 200);
    return Effect.gen(function* () {
      yield* giveContact;
      const first = Context.get(yield* Layer.build(Sec.layer), Sec);
      const second = Context.get(yield* Layer.build(Sec.layer), Sec);
      const requests = Array.from({ length: 30 }, (_, n) => (n % 2 === 0 ? first : second));

      yield* runWithClock(
        Effect.forEach(requests, (sec) => sec.getJson(url), {
          concurrency: "unbounded",
        }),
      );

      const starts = seen.map((request) => request.at).sort((a, b) => a - b);
      expect(starts).toHaveLength(30);
      for (let n = 10; n < starts.length; n++) {
        expect(starts[n]! - starts[n - 10]!).toBeGreaterThanOrEqual(1000);
      }
    }).pipe(Effect.provide(services));
  });

  it.effect("every request carries the contact details", () => {
    const seen: Array<Seen> = [];
    const { services, giveContact } = setup(seen, () => 200);
    return Effect.gen(function* () {
      yield* giveContact;
      const sec = yield* Sec;
      yield* sec.getJson(url);
      expect(seen.map((request) => request.userAgent)).toEqual([contact]);
    }).pipe(Effect.provide(Sec.layer.pipe(Layer.provideMerge(services))));
  });

  it.effect("takes the contact from the environment when the dialog has none", () => {
    const seen: Array<Seen> = [];
    const { services } = setup(seen, () => 200, false);
    const before = {
      name: process.env.SEC_CONTACT_NAME,
      email: process.env.SEC_CONTACT_EMAIL,
    };
    process.env.SEC_CONTACT_NAME = "Env Person";
    process.env.SEC_CONTACT_EMAIL = "env@example.com";
    const put = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    };
    return Effect.gen(function* () {
      const sec = yield* Sec;
      yield* sec.getJson(url);
      expect(seen.map((request) => request.userAgent)).toEqual(["Env Person env@example.com"]);
    }).pipe(
      Effect.provide(Sec.layer.pipe(Layer.provideMerge(services))),
      Effect.ensuring(
        Effect.sync(() => {
          put("SEC_CONTACT_NAME", before.name);
          put("SEC_CONTACT_EMAIL", before.email);
        }),
      ),
    );
  });

  it.effect("without contact details nothing is sent", () => {
    const seen: Array<Seen> = [];
    const { services } = setup(seen, () => 200, false);
    return Effect.gen(function* () {
      const sec = yield* Sec;
      const exit = yield* Effect.exit(sec.getJson(url));
      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: "MissingSecContact" })));
      expect(seen).toHaveLength(0);
    }).pipe(Effect.provide(Sec.layer.pipe(Layer.provideMerge(services))));
  });

  it.effect("a busy SEC is tried again until it answers", () => {
    const seen: Array<Seen> = [];
    const { services, giveContact } = setup(seen, (n) => (n < 2 ? 503 : 200));
    return Effect.gen(function* () {
      yield* giveContact;
      const sec = yield* Sec;
      const exit = yield* runWithClock(sec.getJson(url));
      expect(exit).toStrictEqual(Exit.succeed({ ok: true }));
      expect(seen).toHaveLength(3);
    }).pipe(Effect.provide(Sec.layer.pipe(Layer.provideMerge(services))));
  });

  it.effect("a SEC that stays busy is given up on with a reason", () => {
    const seen: Array<Seen> = [];
    const { services, giveContact } = setup(seen, () => 503);
    return Effect.gen(function* () {
      yield* giveContact;
      const sec = yield* Sec;
      const exit = yield* runWithClock(sec.getJson(url));
      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: "SecUnavailable" })));
      expect(seen).toHaveLength(5);
    }).pipe(Effect.provide(Sec.layer.pipe(Layer.provideMerge(services))));
  });

  it.effect("a refusal is never tried again", () => {
    const seen: Array<Seen> = [];
    const { services, giveContact } = setup(seen, () => 403);
    return Effect.gen(function* () {
      yield* giveContact;
      const sec = yield* Sec;
      const exit = yield* runWithClock(sec.getJson(url));
      expect(exit).toStrictEqual(Exit.fail(expect.objectContaining({ _tag: "SecRefused" })));
      expect(seen).toHaveLength(1);
    }).pipe(Effect.provide(Sec.layer.pipe(Layer.provideMerge(services))));
  });
});
