// Plain data shared by the server and the screens. No Effect here.

export type Source = {
  readonly tag: string;
  readonly value: number;
  readonly accession: string;
  readonly filedOn: string;
};

export type SetAside = Source & { readonly doubtful: string };

export type Figure =
  | {
      readonly kind: "reported";
      readonly value: number;
      readonly latest: Source;
      readonly original: Source;
    }
  | {
      readonly kind: "calculated";
      readonly value: number;
      readonly from: ReadonlyArray<{
        readonly name: string;
        readonly value: number;
      }>;
      readonly setAside: SetAside | null;
      // A plain sentence for calculations that are not a sum, such as a
      // share split. Otherwise the screen reads `from` as a sum.
      readonly how?: string;
      readonly latest?: Source;
    }
  | { readonly kind: "gap" };

export type CheckedFigure = Figure & { readonly doubtful: string | null };

export const valueOf = (figure: Figure | undefined) =>
  figure === undefined || figure.kind === "gap" ? null : figure.value;

export const gapFigure: CheckedFigure = { kind: "gap", doubtful: null };
