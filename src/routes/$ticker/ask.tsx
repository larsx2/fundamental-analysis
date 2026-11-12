import { createFileRoute } from "@tanstack/react-router";
import { useCallback } from "react";
import { Conversation } from "../../ui/ask/conversation";
import { searchYear, useReadyCompany } from "../../ui/company-frame";
import { shortName } from "../../ui/logo-tile";
import { ownFigureLine } from "../../ui/own-figure";
import { OwnFigures } from "../../ui/term";

export const Route = createFileRoute("/$ticker/ask")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { q?: string | undefined; year?: number | undefined; t?: string | undefined } => {
    const year = searchYear(search);
    return {
      ...(typeof search.q === "string" && search.q.trim() !== "" ? { q: search.q.trim() } : {}),
      ...(year === undefined ? {} : { year }),
      ...(typeof search.t === "string" && search.t !== "" ? { t: search.t } : {}),
    };
  },
  component: Ask,
});

function Ask() {
  const { ticker } = Route.useParams();
  const { q, year: askedYear, t } = Route.useSearch();
  const { view, year } = useReadyCompany(ticker, askedYear);
  const name = shortName(view.name);
  const ownFigure = useCallback(
    (termName: string) => ownFigureLine({ termName, year, cik: view.cik, companyName: name }),
    [year, view.cik, name],
  );
  return (
    <OwnFigures figure={ownFigure}>
      <Conversation
        start={{ ticker: view.ticker, cik: view.cik, name: view.name }}
        q={q}
        t={t}
        c={[]}
      />
    </OwnFigures>
  );
}
