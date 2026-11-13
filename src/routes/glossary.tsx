import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Fragment,
  type ReactNode,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { allTerms, type GlossaryTerm, glossary } from "../glossary/glossary";
import { Icon } from "../ui/icons";
import { forgetLearnedTerms, useLearnedTerms } from "../ui/learned-terms";
import { Screen } from "../ui/screen";
import { useStickyTop } from "../ui/sticky";

export const Route = createFileRoute("/glossary")({ component: GlossaryPage });

const sectionOf = new Map(allTerms.map((term) => [term.slug, term.section]));
const sectionSlugs = new Map(glossary.sections.map((section) => [section.slug, section.number]));

// Mentions of other terms in a definition link to them, first mention only.
// The tool's own words are left out: "gap" in plain English is not the tool's gap.
const linkable = allTerms
  .filter((term) => term.section !== 12)
  .sort((a, b) => b.name.length - a.name.length);
const mention = new RegExp(
  `(?<![A-Za-z])(${linkable.map((term) => term.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(s)?(?![A-Za-z])`,
  "gi",
);
const byName = new Map(linkable.map((term) => [term.name.toLowerCase(), term]));

const highlight = (text: string, query: string): ReactNode => {
  if (query === "") return text;
  const parts: Array<ReactNode> = [];
  const lower = text.toLowerCase();
  let from = 0;
  let at = lower.indexOf(query);
  while (at >= 0) {
    parts.push(text.slice(from, at), <mark key={at}>{text.slice(at, at + query.length)}</mark>);
    from = at + query.length;
    at = lower.indexOf(query, from);
  }
  parts.push(text.slice(from));
  return parts;
};

const linked = (
  text: string,
  self: GlossaryTerm,
  query: string,
  go: (slug: string) => void,
): ReactNode => {
  const seen = new Set([self.slug]);
  const out: Array<ReactNode> = [];
  let from = 0;
  for (const match of text.matchAll(mention)) {
    const target = byName.get(match[1]!.toLowerCase());
    if (target === undefined || seen.has(target.slug)) continue;
    seen.add(target.slug);
    out.push(
      <Fragment key={`t${from}`}>{highlight(text.slice(from, match.index), query)}</Fragment>,
    );
    out.push(
      <a
        key={match.index}
        className="xref"
        href={`#${target.slug}`}
        onClick={(event) => {
          event.preventDefault();
          go(target.slug);
        }}
      >
        {highlight(match[0], query)}
      </a>,
    );
    from = match.index + match[0].length;
  }
  out.push(<Fragment key="end">{highlight(text.slice(from), query)}</Fragment>);
  return out;
};

function GlossaryPage() {
  const navigate = useNavigate();
  const [current, setCurrent] = useState(glossary.sections[0]!.number);
  const [jumped, setJumped] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [arrival, setArrival] = useState(0);
  const filterInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const side = useRef<HTMLElement>(null);
  useStickyTop(side, 24);
  const learned = useLearnedTerms();
  const query = filter.trim().toLowerCase();
  const total = allTerms.length;

  const matches = useMemo(
    () =>
      new Set(
        allTerms
          .filter(
            (term) =>
              query === "" ||
              `${term.name}\n${term.definition}\n${term.example}\n${term.avoid}`
                .toLowerCase()
                .includes(query),
          )
          .map((term) => term.slug),
      ),
    [query],
  );

  // Choosing a section fades it in on the right; the list on the left stays put.
  const show = (slug: string, { focus = true, push = true } = {}) => {
    const sectionNumber = sectionSlugs.get(slug) ?? sectionOf.get(slug);
    if (sectionNumber === undefined) return;
    // The router would scroll the page to the section; it stays where it is.
    if (push && location.hash !== `#${slug}`)
      void navigate({ to: "/glossary", hash: slug, hashScrollIntoView: false, resetScroll: false });
    setFilter("");
    setCurrent(sectionNumber);
    setArrival((count) => count + 1);
    const term = sectionOf.has(slug) ? slug : null;
    setJumped(term);
    requestAnimationFrame(() => {
      if (term !== null) {
        const entry = document.getElementById(term);
        entry?.scrollIntoView({ block: "center" });
        if (focus) entry?.querySelector<HTMLElement>("h3 a")?.focus({ preventScroll: true });
      } else {
        // The page stays where it is unless the section starts above the window.
        const shownTop = panel.current?.getBoundingClientRect().top ?? 0;
        if (shownTop < 0) window.scrollTo({ top: Math.max(0, shownTop + window.scrollY - 24) });
        if (focus) document.getElementById(`${slug}-title`)?.focus({ preventScroll: true });
      }
    });
  };

  const showFromHash = useEffectEvent(() => {
    const slug = decodeURIComponent(location.hash.slice(1));
    if (slug !== "") show(slug, { focus: false, push: false });
  });

  useEffect(() => {
    document.title = "Glossary";
    const fromHash = () => showFromHash();
    fromHash();
    window.addEventListener("hashchange", fromHash);
    window.addEventListener("popstate", fromHash);
    return () => {
      window.removeEventListener("hashchange", fromHash);
      window.removeEventListener("popstate", fromHash);
    };
  }, []);

  // The slash key goes to the filter.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey) return;
      if ((event.target as Element | null)?.closest("input, textarea, [role=dialog]") != null)
        return;
      event.preventDefault();
      filterInput.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const shown = glossary.sections.filter((section) =>
    query === ""
      ? section.number === current
      : section.terms.some((term) => matches.has(term.slug)),
  );

  return (
    <Screen active="glossary" className="glossary">
      <div>
        <h1 className="m-0 mb-2 text-xl font-semibold tracking-[-0.01em]">Glossary</h1>
        <p className="m-0 max-w-[64ch] text-text-2">{glossary.intro}</p>
        {learned.size > 0 && (
          <p className="m-0 mt-2 max-w-[64ch] text-s text-text-3">
            {learned.size === 1
              ? "1 term you have opened is"
              : `${learned.size} terms you have opened are`}{" "}
            no longer underlined on the company screens.{" "}
            <button type="button" className="link-button" onClick={forgetLearnedTerms}>
              Underline them again
            </button>
          </p>
        )}
      </div>
      <div className="shape">
        <aside className="side" aria-label="Filter and sections" ref={side}>
          <div className="filter-box">
            <Icon name="filter" />
            <input
              ref={filterInput}
              type="search"
              aria-label="Filter terms"
              aria-describedby="filter-status"
              autoComplete="off"
              spellCheck={false}
              placeholder={`Filter ${total} terms`}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape" && filter !== "") {
                  event.preventDefault();
                  setFilter("");
                } else if (event.key === "Enter") {
                  const first = allTerms.find((term) => matches.has(term.slug));
                  if (first !== undefined && query !== "") {
                    event.preventDefault();
                    show(first.slug);
                  }
                }
              }}
            />
            <kbd aria-hidden="true">/</kbd>
          </div>
          <p className="filter-status" id="filter-status" aria-live="polite">
            {query === ""
              ? ""
              : matches.size > 0
                ? `${matches.size} of ${total} terms match.`
                : "No term matches."}
          </p>
          <nav aria-label="Sections">
            <ol className="sections">
              {glossary.sections.map((section) => {
                const count = section.terms.filter((term) => matches.has(term.slug)).length;
                return (
                  <li key={section.number}>
                    <a
                      href={`#${section.slug}`}
                      aria-current={query === "" && section.number === current ? "true" : undefined}
                      className={count === 0 ? "empty" : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        show(section.slug);
                      }}
                    >
                      <span className="section-number">{section.number}</span>
                      <span>{section.title}</span>
                      <span className="n">{count}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
          </nav>
        </aside>
        <div className="terms" ref={panel}>
          {shown.map((section) => (
            <section
              key={`${section.number}-${query === "" ? arrival : "filter"}`}
              className="group enter"
              id={section.slug}
              aria-labelledby={`${section.slug}-title`}
            >
              <h2 id={`${section.slug}-title`} tabIndex={-1}>
                <span className="section-number">{section.number}</span>
                <span>{section.title}</span>
              </h2>
              {section.note !== "" && <p className="group-note">{section.note}</p>}
              {section.terms
                .filter((term) => matches.has(term.slug))
                .map((term) => (
                  <article
                    key={term.slug}
                    className={`entry ${jumped === term.slug ? "jumped" : ""}`}
                    id={term.slug}
                    aria-labelledby={`${term.slug}-title`}
                  >
                    <h3 id={`${term.slug}-title`}>
                      <a
                        href={`#${term.slug}`}
                        onClick={(event) => {
                          event.preventDefault();
                          show(term.slug);
                        }}
                      >
                        {highlight(term.name, query)}
                      </a>
                    </h3>
                    <p className="definition">{linked(term.definition, term, query, show)}</p>
                    <p className="example">
                      <span className="label">Example</span>
                      {highlight(term.example, query)}
                    </p>
                    <p className="avoid">
                      <span className="label">Words to avoid</span>
                      {highlight(term.avoid, query)}
                    </p>
                  </article>
                ))}
            </section>
          ))}
          {query !== "" && matches.size === 0 && (
            <div className="none">
              <strong>No term matches {`“${filter.trim()}”`}.</strong>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setFilter("");
                  filterInput.current?.focus();
                }}
              >
                Clear the filter
              </button>{" "}
              to see all {total} terms.
            </div>
          )}
        </div>
      </div>
    </Screen>
  );
}
