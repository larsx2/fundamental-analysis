import type { CheckedFigure } from "../shared/figures";

export function GapMark() {
  return <span className="mark gap">gap</span>;
}

export function CalculatedMark() {
  return <span className="mark">calculated</span>;
}

export function DoubtfulMark() {
  return (
    <span className="mark doubtful">
      <span aria-hidden="true">{"⚠"}</span> doubtful
    </span>
  );
}

export const isDoubtful = (figure: CheckedFigure) =>
  figure.doubtful !== null || (figure.kind === "calculated" && figure.setAside !== null);

// The quiet marks for one figure: nothing for a plain reported number.
export function Marks({ figure }: { readonly figure: CheckedFigure | undefined }) {
  if (figure === undefined || figure.kind === "gap") return <GapMark />;
  const calculated = figure.kind === "calculated";
  if (isDoubtful(figure)) {
    return (
      <span className="inline-flex flex-wrap gap-1">
        {calculated && <CalculatedMark />}
        <DoubtfulMark />
      </span>
    );
  }
  return calculated ? <CalculatedMark /> : null;
}
