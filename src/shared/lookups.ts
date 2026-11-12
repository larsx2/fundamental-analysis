export type FilingLink = {
  readonly form: string;
  readonly filedOn: string;
  readonly url: string;
};

export type Point = {
  readonly fiscalYear: number;
  readonly value: number | null;
};

export type Unit = "money" | "perShare" | "share" | "change" | "cents";

export type Series = {
  readonly name: string;
  readonly term: string | null;
  readonly tone: "white" | "soft" | "grey" | "kept";
  readonly dashed?: boolean;
  readonly points: ReadonlyArray<Point>;
};

export type Shade = {
  readonly fiscalYear: number;
  readonly why: "recession" | "rates";
};

export type Drawing =
  | {
      readonly kind: "lines";
      readonly title: string;
      readonly unit: Unit;
      readonly apart: boolean;
      readonly series: ReadonlyArray<Series>;
      readonly shade: ReadonlyArray<Shade>;
    }
  | {
      readonly kind: "bars";
      readonly title: string;
      readonly unit: Unit;
      readonly rows: boolean;
      readonly series: ReadonlyArray<Series>;
    }
  | {
      readonly kind: "dollar";
      readonly title: string;
      readonly fiscalYear: number;
      readonly parts: ReadonlyArray<{
        readonly key: string;
        readonly name: string;
        readonly cents: number;
      }>;
    }
  | {
      readonly kind: "balance";
      readonly title: string;
      readonly assets: number;
      readonly liabilities: number;
      readonly equity: number | null;
    }
  | {
      readonly kind: "economy";
      readonly title: string;
      readonly months: ReadonlyArray<{
        readonly month: string;
        readonly interestRate: number | null;
        readonly inflation: number | null;
        readonly recession: boolean;
      }>;
      readonly events: ReadonlyArray<{
        readonly date: string;
        readonly title: string;
        readonly url: string;
      }>;
    }
  | {
      readonly kind: "marks";
      readonly title: string;
      readonly rows: ReadonlyArray<{
        readonly name: string;
        readonly value: string;
        readonly mark: "reported" | "calculated" | "gap" | "doubtful";
        readonly filedOn: string | null;
      }>;
    }
  | {
      readonly kind: "quote";
      readonly title: string;
      readonly text: string;
      readonly source: string;
      readonly url: string;
    };

export type LookupResult = {
  readonly lookup: string;
  readonly title: string;
  readonly detail: string;
  readonly figures: Readonly<Record<string, string>>;
  readonly notes: ReadonlyArray<string>;
  readonly drawing: Drawing | null;
  readonly filings: ReadonlyArray<FilingLink>;
};

export type Answer = {
  readonly lead: string;
  readonly sentences: ReadonlyArray<string>;
  readonly drawing: string | null;
  readonly next: ReadonlyArray<string>;
};

export type AskEvent =
  | {
      readonly type: "reading";
      readonly id: string;
      readonly lookup: string;
      readonly input: unknown;
    }
  | { readonly type: "thinking"; readonly id: string; readonly text: string }
  | {
      readonly type: "read";
      readonly id: string;
      readonly lookup: string;
      readonly result: LookupResult | null;
      readonly error: string | null;
    }
  | { readonly type: "answer"; readonly answer: Answer }
  | {
      readonly type: "failed";
      readonly signedOut: boolean;
      readonly message: string;
    };
