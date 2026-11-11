import { Clock, Context, Data, Duration, Effect, Layer, Option, Schedule, Semaphore } from "effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import { SqlClient } from "effect/sql/SqlClient";
import { Settings, secContactKey } from "./settings";

/**
 * The SEC allows at most ten requests per second. The tool stays below that,
 * at one request every 125 milliseconds, which is eight per second.
 */
export const gapBetweenRequests = Duration.millis(125);

/** How many times a request that failed for a passing reason is tried again. */
export const retries = 4;

// Errors as named kinds. Each failure the caller may need to tell apart has
// its own class, and the type of every Effect lists which ones it can fail
// with, so nothing can forget to handle one.

/** No contact details have been given, so no request may be sent. */
export class MissingSecContact extends Data.TaggedError("MissingSecContact")<{}> {
  override get message() {
    return "The SEC asks every program that reads its data for a name and an email address. Give them before collecting.";
  }
}

/** The SEC has nothing at this address. Trying again would not help. */
export class SecNotFound extends Data.TaggedError("SecNotFound")<{
  readonly url: string;
}> {
  override get message() {
    return `The SEC has nothing at ${this.url}.`;
  }
}

/**
 * The SEC refused the request. It does this when contact details are missing
 * or when too many requests were sent, and the block lifts after about ten
 * minutes. It is never retried, so the tool does not make matters worse.
 */
export class SecRefused extends Data.TaggedError("SecRefused")<{
  readonly url: string;
  readonly status: number;
}> {
  override get message() {
    return `The SEC refused the request for ${this.url} (status ${this.status}). Wait ten minutes before trying again.`;
  }
}

/** The SEC could not be reached, or kept failing, after every retry. */
export class SecUnavailable extends Data.TaggedError("SecUnavailable")<{
  readonly url: string;
  readonly cause: unknown;
}> {
  override get message() {
    return `The SEC could not be reached for ${this.url} after ${retries + 1} tries.`;
  }
}

export type SecError = MissingSecContact | SecNotFound | SecRefused | SecUnavailable;

/** A failure worth trying again: the network dropped, or the SEC was busy. */
class Passing extends Data.TaggedError("Passing")<{
  readonly cause: unknown;
}> {}

/** The one way the tool talks to the SEC. Nothing else sends it requests. */
export class Sec extends Context.Service<
  Sec,
  { readonly getJson: (url: string) => Effect.Effect<unknown, SecError> }
>()("Sec") {
  static readonly layer = Layer.effect(
    Sec,
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const settings = yield* Settings;
      const http = yield* HttpClient.HttpClient;
      const gap = Duration.toMillis(gapBetweenRequests);

      // Taking a slot is one statement, so two copies of the tool can never
      // be handed the same slot. Each slot starts `gap` after the one before,
      // or now if the last one has passed. The lock keeps requests from this
      // copy in line before they reach the database.
      const lock = yield* Semaphore.make(1);
      const waitForSlot = Effect.gen(function* () {
        const now = Math.floor(yield* Clock.currentTimeMillis);
        const rows = yield* sql<{ start_at: number }>`
          INSERT INTO sec_request_slot (id, next_start_at) VALUES (1, ${now + gap})
          ON CONFLICT (id) DO UPDATE SET next_start_at = max(next_start_at, ${now}) + ${gap}
          RETURNING next_start_at - ${gap} AS start_at
        `;
        const startAt = rows[0]?.start_at ?? now;
        if (startAt > now) yield* Effect.sleep(Duration.millis(startAt - now));
      }).pipe(Semaphore.withPermits(lock, 1), Effect.orDie);

      const contact = settings.get(secContactKey).pipe(
        Effect.orDie,
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.fail(new MissingSecContact()),
            onSome: Effect.succeed,
          }),
        ),
      );

      // One try: wait for a slot, send, and sort the answer into a result,
      // a failure worth retrying, or a failure that is final.
      const attempt = (url: string, userAgent: string) =>
        Effect.gen(function* () {
          yield* waitForSlot;
          const response = yield* http
            .execute(
              HttpClientRequest.get(url).pipe(
                HttpClientRequest.setHeader("User-Agent", userAgent),
                HttpClientRequest.setHeader("Accept", "application/json"),
              ),
            )
            .pipe(Effect.mapError((cause) => new Passing({ cause })));

          const status = response.status;
          if (status === 200) {
            return yield* response.json.pipe(Effect.mapError((cause) => new Passing({ cause })));
          }
          if (status === 404) return yield* new SecNotFound({ url });
          if (status === 429 || status >= 500) {
            return yield* new Passing({ cause: `status ${status}` });
          }
          return yield* new SecRefused({ url, status });
        });

      // A retry schedule: wait half a second, then one, two and four seconds,
      // each with some randomness so retries do not bunch up. Every retry
      // still waits for its own slot, so retries count against the limit.
      const retrySchedule = Schedule.exponential(Duration.millis(500)).pipe(Schedule.jittered);

      const getJson = (url: string) =>
        Effect.gen(function* () {
          const userAgent = yield* contact;
          return yield* attempt(url, userAgent).pipe(
            Effect.retry({
              schedule: retrySchedule,
              times: retries,
              while: (error) => error._tag === "Passing",
            }),
            Effect.catchTag("Passing", (error) =>
              Effect.fail(new SecUnavailable({ url, cause: error.cause })),
            ),
          );
        });

      return Sec.of({ getJson });
    }),
  );
}
