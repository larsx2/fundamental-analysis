import { longDate } from "../format";
import type { AskState, LookupRead } from "./use-ask";

const readingNames: Record<string, string> = {
  company: "The company",
  trend: "Figures across fiscal years",
  dollar: "Where each dollar went",
  cash: "Net income and free cash flow",
  balance: "The balance sheet",
  uses_of_cash: "Uses of cash",
  returns: "Operating income, debt and equity",
  context: "The economy and corporate events",
  marks: "Marks on every figure",
  glossary: "The glossary",
};

const stateIcon = {
  reading: <path d="M12 4a8 8 0 1 1-8 8" />,
  read: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12.2l2.4 2.4 4.6-4.8" />
    </>
  ),
  failed: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </>
  ),
};

export function Sources({
  turnId,
  state,
  lit,
  onLight,
}: {
  readonly turnId: string;
  readonly state: AskState;
  readonly lit: string | null;
  readonly onLight: (source: string | null) => void;
}) {
  const filings = [
    ...new Map(
      state.lookups
        .flatMap((read) => read.result?.filings ?? [])
        .map((filing) => [filing.url, filing] as const),
    ).values(),
  ].sort((a, b) => b.filedOn.localeCompare(a.filedOn));
  return (
    <aside className="ask-sources" aria-labelledby="read-title">
      <h2 className="eyebrow" id="read-title">
        What it read
      </h2>
      <ul className="ask-read">
        {state.lookups.map((read) => (
          <Read
            key={read.id}
            read={read}
            lit={lit === `${turnId}:${read.id}`}
            onLight={(source) => onLight(source === null ? null : `${turnId}:${source}`)}
          />
        ))}
      </ul>
      {filings.length > 0 && (
        <>
          <h3 className="ask-read-section">Filings the figures come from</h3>
          <ul className="ask-read">
            {filings.map((filing) => (
              <li key={filing.url} data-state="read">
                <svg
                  className="state"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M7 3h7l4 4v14H7z" />
                  <path d="M14 3v4h4" />
                </svg>
                <div>
                  <a href={filing.url} target="_blank" rel="noreferrer">
                    {filing.form}
                  </a>
                  <span>Filed {longDate(filing.filedOn)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </aside>
  );
}

function Read({
  read,
  lit,
  onLight,
}: {
  readonly read: LookupRead;
  readonly lit: boolean;
  readonly onLight: (source: string | null) => void;
}) {
  return (
    <li
      data-state={read.status}
      className={lit ? "lit" : ""}
      onMouseEnter={() => onLight(read.id)}
      onMouseLeave={() => onLight(null)}
    >
      <svg
        className="state"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        {stateIcon[read.status]}
      </svg>
      <div>
        <strong>{read.result?.title ?? readingNames[read.lookup] ?? read.lookup}</strong>
        <span>
          {read.status === "reading"
            ? "Reading"
            : read.status === "failed"
              ? (read.error ?? "Nothing came back")
              : read.result?.detail}
        </span>
      </div>
    </li>
  );
}
