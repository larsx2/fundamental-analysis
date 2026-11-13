import { useAskToCollect } from "../collect-dialog";
import { LogoTile } from "../logo-tile";

export function Welcome() {
  const askToCollect = useAskToCollect();
  const suggestions = [
    { cik: 320193, name: "Apple Inc.", ticker: "AAPL" },
    { cik: 909832, name: "Costco Wholesale Corp", ticker: "COST" },
    { cik: 789019, name: "Microsoft Corp", ticker: "MSFT" },
  ];
  return (
    <section className="panel welcome" aria-labelledby="welcome-title">
      <h2 id="welcome-title">Start with one company</h2>
      <p>
        Find any public company by name or ticker. The first time you choose one, the tool collects
        its filings from the SEC and keeps them on this computer. After that it opens straight away.
      </p>
      <ol className="steps">
        <li>
          <span>
            <strong>Find it</strong>by name or ticker, such as Costco or COST.
          </span>
        </li>
        <li>
          <span>
            <strong>Agree to collect it</strong>and keep reading while it runs.
          </span>
        </li>
        <li>
          <span>
            <strong>Open it</strong>when it is ready, usually within seconds.
          </span>
        </li>
      </ol>
      <p className="suggest-label" id="suggest-label">
        Good first companies
      </p>
      <div className="suggest" role="group" aria-labelledby="suggest-label">
        {suggestions.map((company) => (
          <button
            key={company.cik}
            type="button"
            onClick={() => askToCollect(company, { open: true })}
          >
            <LogoTile name={company.name} cik={company.cik} size={32} />
            <span>{company.name}</span>
            <span className="ticker">{company.ticker}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
