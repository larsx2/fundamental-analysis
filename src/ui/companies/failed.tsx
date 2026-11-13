import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { collectCompany, type ListedCompany } from "../../functions/companies";
import { LogoTile, plainName } from "../logo-tile";
import { RemoveButton } from "../remove-company";

export function Failed({ companies }: { readonly companies: ReadonlyArray<ListedCompany> }) {
  const queryClient = useQueryClient();
  const [problems, setProblems] = useState<Readonly<Record<number, string>>>({});
  const tryAgain = async (cik: number) => {
    setProblems((was) =>
      Object.fromEntries(Object.entries(was).filter(([key]) => Number(key) !== cik)),
    );
    try {
      const answer = await collectCompany({ data: { cik } });
      if (answer.answer === "not covered" || answer.answer === "could not ask") {
        setProblems((was) => ({ ...was, [cik]: answer.reason }));
      }
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
    } catch {
      setProblems((was) => ({
        ...was,
        [cik]: "The tool could not start collecting. Try again in a moment.",
      }));
    }
  };
  return (
    <section className="mt-12" aria-labelledby="failed-title">
      <h2 id="failed-title" className="m-0 mb-3 text-m font-semibold">
        Could not be collected
        <span className="ml-1.5 font-normal text-text-3">{companies.length}</span>
      </h2>
      <ul className="rows">
        {companies.map((company) => (
          <li key={company.cik} data-cik={company.cik} tabIndex={-1}>
            <LogoTile name={plainName(company.name)} cik={company.cik} size={44} />
            <div className="row-main">
              <div className="row-title">
                <strong>{plainName(company.name)}</strong>
                <span className="ticker">{company.ticker}</span>
              </div>
              <div className="text-xs text-text-2" role="status">
                {problems[company.cik] ?? company.failureReason}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="quiet-button"
                onClick={() => void tryAgain(company.cik)}
              >
                Try again
              </button>
              <RemoveButton company={company} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
