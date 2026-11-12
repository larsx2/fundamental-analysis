import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { collectCompany } from "../functions/companies";
import { type CompanyView, companyQuery } from "../functions/company";
import { useAskToCollect } from "../ui/collect-dialog";
import { CollectProgress } from "../ui/collect-progress";
import { LogoTile, plainName } from "../ui/logo-tile";
import { useHere } from "../ui/palette";
import { Screen } from "../ui/screen";
import { Term } from "../ui/term";

export const Route = createFileRoute("/$ticker")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(companyQuery(params.ticker)),
  component: CompanyLayout,
});

const working = (view: CompanyView | null | undefined) =>
  view?.state === "waiting" || view?.state === "collecting";

function CompanyLayout() {
  const { ticker } = Route.useParams();
  const { data } = useQuery({
    ...companyQuery(ticker),
    refetchInterval: (query) => (working(query.state.data) ? 1000 : false),
  });
  if (data === undefined) return null;
  if (data === null) return <UnknownTicker ticker={ticker} />;
  if (data.state !== "ready" || data.details === null) return <NotReady view={data} />;
  return <Outlet />;
}

function StateFrame({
  name,
  ticker,
  children,
}: {
  readonly name: string;
  readonly ticker: string;
  readonly children: React.ReactNode;
}) {
  const here = useHere();
  return (
    <Screen active={here.screen ?? "overview"}>
      <div className="mb-8 flex items-center gap-3">
        <LogoTile name={name} size={40} />
        <span className="text-xl font-semibold tracking-[0.01em]">{ticker}</span>
        <h1 className="visually-hidden">{name}</h1>
      </div>
      <section className="panel max-w-[680px] p-8 max-[560px]:p-6">{children}</section>
    </Screen>
  );
}

function UnknownTicker({ ticker }: { readonly ticker: string }) {
  return (
    <Screen active="overview">
      <section className="panel max-w-[680px] p-8 max-[560px]:p-6">
        <h1 className="m-0 mb-3 text-l font-semibold">No public company has the ticker {ticker}</h1>
        <p className="m-0 text-text-2">
          The SEC's list of public companies has no <Term name="Ticker">ticker</Term> {ticker}.
          Search by name on the Companies screen instead.
        </p>
        <div className="actions justify-start">
          <Link className="button primary" to="/companies">
            Go to Companies
          </Link>
        </div>
      </section>
    </Screen>
  );
}

function NotReady({ view }: { readonly view: CompanyView }) {
  const askToCollect = useAskToCollect();
  const queryClient = useQueryClient();
  const [trying, setTrying] = useState(false);
  const name = plainName(view.name);

  if (view.state === "waiting" || view.state === "collecting") {
    return (
      <StateFrame name={name} ticker={view.ticker}>
        <h2 className="m-0 mb-2 text-l font-semibold">
          {view.state === "waiting" ? `${name} is waiting to be collected` : `Collecting ${name}`}
        </h2>
        <p className="m-0 mb-6 text-text-2">
          The tool is fetching its annual reports (10-K) from the SEC and checking the numbers in
          them. This screen opens by itself when it is ready, usually within seconds.
        </p>
        <CollectProgress name={name} state={view.state} step={view.collectStep} />
      </StateFrame>
    );
  }

  if (view.state === "failed") {
    return (
      <StateFrame name={name} ticker={view.ticker}>
        <h2 className="m-0 mb-2 text-l font-semibold">{name} could not be collected</h2>
        <p className="m-0 mb-2 text-text-2">{view.failureReason}</p>
        <p className="m-0 text-text-2">Nothing was kept from the attempt. You can try again.</p>
        <div className="actions justify-start">
          <button
            type="button"
            className="button primary"
            disabled={trying}
            onClick={async () => {
              setTrying(true);
              await collectCompany({ data: { cik: view.cik } });
              await queryClient.invalidateQueries({ queryKey: ["company"] });
              await queryClient.invalidateQueries({ queryKey: ["companies"] });
              setTrying(false);
            }}
          >
            Try again
          </button>
        </div>
      </StateFrame>
    );
  }

  if (view.notCoveredReason !== null) {
    return (
      <StateFrame name={name} ticker={view.ticker}>
        <h2 className="m-0 mb-2 text-l font-semibold">
          {name} is <Term name="Not covered">not covered</Term>
        </h2>
        <p className="m-0 mb-2 text-text-2">{view.notCoveredReason}</p>
        <p className="m-0 text-text-2">
          The first version covers companies that file an annual report (10-K), except banks,
          insurers and property trusts.
        </p>
        <div className="actions justify-start">
          <Link className="button" to="/companies">
            Choose another company
          </Link>
        </div>
      </StateFrame>
    );
  }

  return (
    <StateFrame name={name} ticker={view.ticker}>
      <h2 className="m-0 mb-2 text-l font-semibold">
        {name} is <Term name="Not collected">not collected</Term> yet
      </h2>
      <p className="m-0 text-text-2">
        The tool knows {name} by name and ticker only. Collecting fetches its annual reports (10-K)
        from the SEC, checks the numbers in them and keeps them on this computer. It runs in the
        background and is usually ready within seconds.
      </p>
      <div className="actions justify-start">
        <button
          type="button"
          className="button primary"
          onClick={() => askToCollect({ cik: view.cik, name: view.name })}
        >
          Collect {name}
        </button>
      </div>
    </StateFrame>
  );
}
