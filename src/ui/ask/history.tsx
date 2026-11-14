import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { LogoTile, plainName } from "../logo-tile";
import {
  clearThreads,
  companiesOf,
  deleteThread,
  type Thread,
  useThreadsKnown,
  withoutAt,
} from "./conversations";

export function History({
  threads,
  current,
}: {
  readonly threads: ReadonlyArray<Thread>;
  readonly current: string | null;
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toLowerCase() !== "o") {
        return;
      }
      event.preventDefault();
      void navigate({ to: "/ask" }).then(() => document.getElementById("ask-next")?.focus());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);
  const [clearing, setClearing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  useEffect(() => {
    if (deleting === null) return;
    const timer = setTimeout(() => setDeleting(null), 4000);
    return () => clearTimeout(timer);
  }, [deleting]);
  const count = threads.length;
  const known = useThreadsKnown();
  const body = !known ? null : (
    <>
      {count === 0 ? (
        <p className="ask-history-empty">Your conversations stay here, in this browser.</p>
      ) : (
        <ol className="ask-history-list">
          {threads.map((thread) => (
            <li key={thread.id}>
              <Link
                to="/ask"
                search={{ t: thread.id }}
                aria-current={thread.id === current ? "page" : undefined}
              >
                <Logos thread={thread} />
                <span className="ask-history-text">
                  <span>{withoutAt(thread.turns[0]?.question ?? "", companiesOf(thread))}</span>
                </span>
              </Link>
              <button
                type="button"
                className="ask-history-delete"
                data-armed={deleting === thread.id || undefined}
                aria-label={
                  deleting === thread.id
                    ? "Press again to delete this conversation"
                    : `Delete the conversation "${thread.turns[0]?.question ?? ""}"`
                }
                title={deleting === thread.id ? "Press again to delete" : "Delete"}
                onClick={() => {
                  if (deleting !== thread.id) {
                    setDeleting(thread.id);
                    return;
                  }
                  deleteThread(thread.id);
                  setDeleting(null);
                  if (thread.id === current) void navigate({ to: "/ask" });
                }}
                onBlur={() => setDeleting(null)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setDeleting(null);
                }}
              >
                {deleting === thread.id ? (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.2a1 1 0 0 0 1 .8h3.8a1 1 0 0 0 1-.8l.6-8.2" />
                  </svg>
                ) : (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    aria-hidden="true"
                  >
                    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ol>
      )}
      {count > 0 &&
        (clearing ? (
          <div className="ask-clear" role="group" aria-label="Clear all conversations">
            <span>Clear {count === 1 ? "this conversation" : `all ${count} conversations`}?</span>
            <div>
              <button
                type="button"
                className="ask-clear-yes"
                onClick={() => {
                  clearThreads();
                  setClearing(false);
                  void navigate({ to: "/ask" });
                }}
              >
                Clear
              </button>
              <button type="button" className="ask-clear-no" onClick={() => setClearing(false)}>
                Keep
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="ask-clear-start" onClick={() => setClearing(true)}>
            Clear all conversations
          </button>
        ))}
    </>
  );
  if (known && count === 0) return null;
  return (
    <nav className="ask-history" aria-label="Conversations">
      <Link
        className="ask-new"
        aria-keyshortcuts="Meta+Shift+O"
        to="/ask"
        onClick={() => requestAnimationFrame(() => document.getElementById("ask-next")?.focus())}
      >
        <span className="ask-new-mark" aria-hidden="true">
          <Icon name="plus" />
        </span>
        <span>New conversation</span>
      </Link>
      <h2 className="ask-history-head">Conversations</h2>
      <div className="ask-history-wide">{body}</div>
      <details className="ask-history-narrow">
        <summary>{!known || count === 0 ? "Conversations" : `Conversations (${count})`}</summary>
        {body}
      </details>
    </nav>
  );
}

function Logos({ thread }: { readonly thread: Thread }) {
  const companies = companiesOf(thread);
  if (companies.length === 0) {
    return (
      <span className="ask-history-general" aria-hidden="true">
        <Icon name="glossary" />
      </span>
    );
  }
  return (
    <span className="ask-logos" data-count={Math.min(companies.length, 3)}>
      {companies.slice(0, 3).map((company) => (
        <LogoTile key={company.cik} name={plainName(company.name)} cik={company.cik} size={20} />
      ))}
    </span>
  );
}
