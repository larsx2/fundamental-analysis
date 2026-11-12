import { Context, Effect, Layer, Schema } from "effect";
import { SqlClient } from "effect/sql/SqlClient";
import type { SqlError } from "effect/sql/SqlError";
import * as SqlSchema from "effect/sql/SqlSchema";

export type Filing = {
  readonly accession: string;
  readonly form: string;
  readonly filedOn: string;
};

export type ReportedNumber = {
  readonly accession: string;
  readonly taxonomy: string;
  readonly tag: string;
  readonly unit: string;
  readonly startOn: string | null;
  readonly endOn: string;
  readonly fiscalYear: number;
  readonly value: number;
};

const StoredNumber = Schema.Struct({
  accession: Schema.String,
  filedOn: Schema.String,
  form: Schema.String,
  taxonomy: Schema.String,
  tag: Schema.String,
  unit: Schema.String,
  startOn: Schema.NullOr(Schema.String),
  endOn: Schema.String,
  fiscalYear: Schema.Int,
  value: Schema.Finite,
});
export type StoredNumber = typeof StoredNumber.Type;

export class ReportedNumbers extends Context.Service<
  ReportedNumbers,
  {
    readonly save: (
      cik: number,
      filings: ReadonlyArray<Filing>,
      numbers: ReadonlyArray<ReportedNumber>,
    ) => Effect.Effect<void, SqlError>;
    readonly forTag: (
      cik: number,
      tag: string,
    ) => Effect.Effect<ReadonlyArray<StoredNumber>, SqlError | Schema.SchemaError>;
  }
>()("ReportedNumbers") {
  static readonly layer = Layer.effect(
    ReportedNumbers,
    Effect.gen(function* () {
      const sql = yield* SqlClient;

      const save = (
        cik: number,
        filings: ReadonlyArray<Filing>,
        numbers: ReadonlyArray<ReportedNumber>,
      ) =>
        sql.withTransaction(
          Effect.gen(function* () {
            for (const filing of filings) {
              yield* sql`
                INSERT INTO filing (accession, cik, form, filed_on)
                VALUES (${filing.accession}, ${cik}, ${filing.form}, ${filing.filedOn})
                ON CONFLICT (accession) DO NOTHING
              `;
            }
            for (const number of numbers) {
              yield* sql`
                INSERT INTO reported_number
                  (accession, cik, taxonomy, tag, unit, start_on, end_on, fiscal_year, value)
                VALUES (
                  ${number.accession}, ${cik}, ${number.taxonomy}, ${number.tag}, ${number.unit},
                  ${number.startOn}, ${number.endOn}, ${number.fiscalYear}, ${number.value}
                )
                ON CONFLICT DO NOTHING
              `;
            }
          }),
        );

      const forTag = SqlSchema.findAll({
        Request: Schema.Struct({ cik: Schema.Int, tag: Schema.String }),
        Result: StoredNumber,
        execute: ({ cik, tag }) => sql`
          SELECT
            n.accession, f.filed_on AS "filedOn", f.form, n.taxonomy, n.tag, n.unit,
            n.start_on AS "startOn", n.end_on AS "endOn", n.fiscal_year AS "fiscalYear", n.value
          FROM reported_number n JOIN filing f USING (accession)
          WHERE n.cik = ${cik} AND n.tag = ${tag}
          ORDER BY n.fiscal_year, f.filed_on
        `,
      });

      return ReportedNumbers.of({
        save,
        forTag: (cik, tag) => forTag({ cik, tag }),
      });
    }),
  );
}
