// Collecting has three steps. The bar fills by step, since the tool cannot
// know how long the SEC takes to answer each one.
const steps = [
  "Asking the SEC for its list of filings",
  "Fetching its reported numbers",
  "Reading the business description in its annual report",
];

export function CollectProgress({
  name,
  state,
  step,
}: {
  readonly name: string;
  readonly state: "waiting" | "collecting";
  readonly step: number | null;
}) {
  const done = state === "waiting" ? 0 : Math.max(0, (step ?? 1) - 1);
  const share = state === "waiting" ? 0 : (done + 0.5) / steps.length;
  return (
    <div>
      <div className="progress-line">
        <span>
          {state === "waiting"
            ? "Waiting in line for the companies asked for before it"
            : `Step ${done + 1} of ${steps.length}: ${steps[done] ?? steps[0]}`}
        </span>
      </div>
      <div
        className={`bar ${state === "waiting" ? "waiting" : ""}`}
        role="progressbar"
        aria-label={`Collecting ${name}`}
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={state === "waiting" ? 0 : done}
        aria-valuetext={state === "waiting" ? "Waiting" : `Step ${done + 1} of ${steps.length}`}
      >
        <i style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}
