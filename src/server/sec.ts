import { Clock, Context, Data, Duration, Effect, Layer, Option, Schedule, Semaphore } from "effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import { SqlClient } from "effect/sql/SqlClient";
import { Settings, secContactKey } from "./settings";

// The SEC allows at most ten requests per second. This keeps to eight.
export const gapBetweenRequests = Duration.millis(125);

export const retries = 4;

export class MissingSecContact extends Data.TaggedError("MissingSecContact")<{}> {
  override get message() {
    return "The SEC asks every program that reads its data for a name and an email address. Give them before collecting.";
  }
}

export class SecNotFound extends Data.TaggedError("SecNotFound")<{
  readonly url: string;
}> {
  override get message() {
    return `The SEC has nothing at ${this.url}.`;
  }
}

export class SecRefused extends Data.TaggedError("SecRefused")<{
  readonly url: string;
  readonly status: number;
}> {
  override get message() {
    return `The SEC refused the request for ${this.url} (status ${this.status}). Wait ten minutes before trying again.`;
  }
}

export class SecUnavailable extends Data.TaggedError("SecUnavailable")<{
  readonly url: string;
  readonly cause: unknown;
}> {
  override get message() {
    return `The SEC could not be reached for ${this.url} after ${retries + 1} tries.`;
  }
}

export type SecError = MissingSecContact | SecNotFound | SecRefused | SecUnavailable;

class WorthRetrying extends Data.TaggedError("WorthRetrying")<{
  readonly cause: unknown;
}> {}

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

      // The slot is taken in a single statement so that every copy of the
      // tool sharing this database is held to the same limit.
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
            .pipe(Effect.mapError((cause) => new WorthRetrying({ cause })));

          const status = response.status;
          if (status === 200) {
            return yield* response.json.pipe(
              Effect.mapError((cause) => new WorthRetrying({ cause })),
            );
          }
          if (status === 404) return yield* new SecNotFound({ url });
          if (status === 429 || status >= 500) {
            return yield* new WorthRetrying({ cause: `status ${status}` });
          }
          // The SEC refuses when too many requests were sent. Retrying would
          // only extend its block, so a refusal is final.
          return yield* new SecRefused({ url, status });
        });

      const retrySchedule = Schedule.exponential(Duration.millis(500)).pipe(Schedule.jittered);

      const getJson = (url: string) =>
        Effect.gen(function* () {
          const userAgent = yield* contact;
          return yield* attempt(url, userAgent).pipe(
            Effect.retry({
              schedule: retrySchedule,
              times: retries,
              while: (error) => error._tag === "WorthRetrying",
            }),
            Effect.catchTag("WorthRetrying", (error) =>
              Effect.fail(new SecUnavailable({ url, cause: error.cause })),
            ),
          );
        });

      return Sec.of({ getJson });
    }),
  );
}
