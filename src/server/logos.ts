import { Clock, Context, Effect, Layer, Option, Schema } from "effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import { SqlClient } from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";

// Logos are trademarks, so none are shipped. Wikidata, the open database
// behind Wikipedia, records each company's SEC number (property P5531), its
// official logo (P154) and sometimes a small icon of it (P8972). The pictures
// themselves are on Wikimedia Commons. Each person's tool fetches the logo of
// a company when it collects it and keeps it on that computer.
//
// Wikimedia asks programs to name themselves. No personal details are sent.
const userAgent = "fundamental-analysis/0.1 (a learning tool that runs on one computer)";

const wikidata = (params: Record<string, string>) =>
  `https://www.wikidata.org/w/api.php?${new URLSearchParams({ ...params, format: "json" })}`;

// Commons draws any logo, even a vector one, as a small picture this wide.
const pictureOf = (file: string) =>
  `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=160`;

const pictureTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const largestPicture = 500_000;

const Search = Schema.Struct({
  query: Schema.Struct({
    search: Schema.Array(Schema.Struct({ title: Schema.String })),
  }),
});

const Claim = Schema.Struct({
  rank: Schema.String,
  mainsnak: Schema.Struct({
    datavalue: Schema.optional(Schema.Struct({ value: Schema.Unknown })),
  }),
  qualifiers: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});

const Claims = Schema.Struct({
  claims: Schema.Record(Schema.String, Schema.Array(Claim)),
});

export type LogoClaim = typeof Claim.Type;

// The logo in use today: the small icon before the full logo, the one marked
// preferred before the others, and never one with an end date (P582), which
// is how Wikidata keeps a company's older logos.
export const chooseLogo = (
  icons: ReadonlyArray<LogoClaim>,
  logos: ReadonlyArray<LogoClaim>,
): string | null => {
  for (const claims of [icons, logos]) {
    const current = claims.filter(
      (claim) =>
        claim.rank !== "deprecated" &&
        claim.qualifiers?.["P582"] === undefined &&
        typeof claim.mainsnak.datavalue?.value === "string",
    );
    const chosen = current.find((claim) => claim.rank === "preferred") ?? current[0];
    if (chosen !== undefined) return chosen.mainsnak.datavalue!.value as string;
  }
  return null;
};

export type Logo = { readonly image: Uint8Array; readonly type: string };

export class Logos extends Context.Service<
  Logos,
  {
    // Finding no logo, or failing to reach Wikidata, never fails a company.
    // When Wikidata cannot be reached, the next start asks again.
    readonly fetch: (cik: number) => Effect.Effect<void>;
    readonly logo: (cik: number) => Effect.Effect<Option.Option<Logo>, SqlError>;
    // Ready companies whose logo was never asked for, such as those
    // collected before the tool fetched logos.
    readonly missing: Effect.Effect<ReadonlyArray<number>, SqlError>;
  }
>()("Logos") {
  static readonly layer = Layer.effect(
    Logos,
    Effect.gen(function* () {
      const sql = yield* SqlClient;
      const http = yield* HttpClient.HttpClient;

      const get = (url: string) =>
        http
          .execute(
            HttpClientRequest.get(url).pipe(HttpClientRequest.setHeader("User-Agent", userAgent)),
          )
          .pipe(
            Effect.filterOrFail(
              (response) => response.status === 200,
              (response) => `status ${response.status}`,
            ),
            Effect.timeout("20 seconds"),
          );

      const getJson = <S extends Schema.Top>(url: string, schema: S) =>
        get(url).pipe(
          Effect.flatMap((response) => response.json),
          Effect.flatMap(Schema.decodeUnknownEffect(schema)),
        );

      const claims = (entity: string, property: string) =>
        getJson(wikidata({ action: "wbgetclaims", entity, property }), Claims).pipe(
          Effect.map((found) => found.claims[property] ?? []),
        );

      // Wikidata writes the SEC number with its leading zeros, and sometimes without.
      const entityOf = (cik: number) =>
        Effect.gen(function* () {
          for (const number of [String(cik).padStart(10, "0"), String(cik)]) {
            const found = yield* getJson(
              wikidata({
                action: "query",
                list: "search",
                srsearch: `haswbstatement:P5531=${number}`,
              }),
              Search,
            );
            if (found.query.search.length === 1) return found.query.search[0]!.title;
            if (found.query.search.length > 1) return null;
          }
          return null;
        });

      const store = (cik: number, found: (Logo & { readonly source: string }) | null) =>
        Effect.gen(function* () {
          const today = new Date(yield* Clock.currentTimeMillis).toLocaleDateString("en-CA");
          yield* sql`
            INSERT INTO company_logo (cik, image, type, source, fetched_on)
            VALUES (
              ${cik}, ${found?.image ?? null}, ${found?.type ?? null}, ${found?.source ?? null},
              ${today}
            )
            ON CONFLICT (cik) DO UPDATE SET
              image = excluded.image, type = excluded.type, source = excluded.source,
              fetched_on = excluded.fetched_on
          `;
        });

      const fetch = (cik: number) =>
        Effect.gen(function* () {
          const entity = yield* entityOf(cik);
          if (entity === null) return yield* store(cik, null);
          const file = chooseLogo(yield* claims(entity, "P8972"), yield* claims(entity, "P154"));
          if (file === null) return yield* store(cik, null);
          const response = yield* get(pictureOf(file));
          // The size is checked before the picture is read, so a wrong answer
          // never fills memory. A picture without a stated size is skipped.
          const type = response.headers["content-type"]?.split(";")[0]?.trim() ?? "";
          const size = Number(response.headers["content-length"] ?? Number.NaN);
          if (!pictureTypes.has(type) || !(size > 0 && size <= largestPicture)) {
            return yield* store(cik, null);
          }
          const image = new Uint8Array(yield* response.arrayBuffer);
          if (image.byteLength > largestPicture) return yield* store(cik, null);
          yield* store(cik, { image, type, source: file });
        }).pipe(
          Effect.ignoreCause({
            log: "Warn",
            message: `Could not fetch the logo of company ${cik}`,
          }),
        );

      const logo = (cik: number) =>
        sql<{ image: Uint8Array; type: string }>`
          SELECT image, type FROM company_logo
          WHERE cik = ${cik} AND image IS NOT NULL AND type IS NOT NULL
        `.pipe(Effect.map((rows) => Option.fromNullishOr(rows[0])));

      const missing = sql<{ cik: number }>`
        SELECT cik FROM company
        WHERE state = 'ready' AND cik NOT IN (SELECT cik FROM company_logo)
        ORDER BY cik
      `.pipe(Effect.map((rows) => rows.map((row) => row.cik)));

      return Logos.of({ fetch, logo, missing });
    }),
  );
}
