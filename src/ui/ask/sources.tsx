import { Link } from "@tanstack/react-router";
import { longDate } from "../../shared/format";
import { filingRows, type ReadRow, readRows } from "./read-rows";
import type { AskState } from "./use-ask";

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
  const filings = filingRows(state.lookups);
  return (
    <aside className="ask-sources" aria-labelledby="read-title">
      <h2 className="eyebrow" id="read-title">
        What it read
      </h2>
      <ul className="ask-read">
        {readRows(state.lookups).map((row) => (
          <Read
            key={row.key}
            row={row}
            lit={row.ids.some((id) => lit === `${turnId}:${id}`)}
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
                  <a className="ask-read-open" href={filing.url} target="_blank" rel="noreferrer">
                    {filing.form} <i aria-hidden="true">↗</i>
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
  row,
  lit,
  onLight,
}: {
  readonly row: ReadRow;
  readonly lit: boolean;
  readonly onLight: (source: string | null) => void;
}) {
  return (
    <li
      data-state={row.status}
      className={lit ? "lit" : ""}
      onMouseEnter={() => onLight(row.ids.at(-1) ?? null)}
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
        {stateIcon[row.status]}
      </svg>
      <div>
        <Title row={row} />
        {row.lines.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </div>
    </li>
  );
}

function Title({ row }: { readonly row: ReadRow }) {
  const opens = row.opens;
  if (opens === null) return <strong>{row.title}</strong>;
  if (opens.kind === "filing") {
    return (
      <a className="ask-read-open" href={opens.url} target="_blank" rel="noreferrer">
        {row.title} <i aria-hidden="true">↗</i>
      </a>
    );
  }
  if (opens.kind === "glossary") {
    return (
      <Link className="ask-read-open" to="/glossary">
        {row.title} <i aria-hidden="true">→</i>
      </Link>
    );
  }
  return (
    <Link className="ask-read-open" to={`/$ticker/${opens.path}`} params={{ ticker: opens.ticker }}>
      {row.title} <i aria-hidden="true">→</i>
    </Link>
  );
}
