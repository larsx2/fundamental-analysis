import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { companiesQuery, type ListedCompany } from "../functions/companies";
import { Icon } from "./icons";
import { LogoTile, plainName } from "./logo-tile";

type Notice = {
  readonly id: number;
  readonly company: { readonly cik: number; readonly name: string; readonly ticker: string };
  readonly text: string;
  readonly link: "open" | "why" | null;
};

type Push = (notice: Omit<Notice, "id">) => void;

const NoticeContext = createContext<Push>(() => {});

export const useNotice = () => useContext(NoticeContext);

let awaited: { readonly cik: number; readonly path: string } | null = null;

export const openWhenReady = (cik: number) => {
  awaited = { cik, path: globalThis.location?.pathname ?? "" };
};

const working = (company: ListedCompany) =>
  company.state === "waiting" || company.state === "collecting";

// While anything is being collected the list is asked for again every
// second. When the company the reader just asked for becomes ready and they
// are still where they asked, it opens; otherwise a quiet notice says so.
// Notices never take focus.
export function Notices({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const here = useRef(path);
  here.current = path;
  const { data } = useQuery({
    ...companiesQuery,
    refetchInterval: (query) => (query.state.data?.companies.some(working) ? 1000 : false),
  });
  const before = useRef<Map<number, ListedCompany["state"]> | null>(null);
  const [notices, setNotices] = useState<ReadonlyArray<Notice>>([]);
  const nextId = useRef(0);

  const push = useCallback<Push>((notice) => {
    setNotices((list) => [...list, { ...notice, id: nextId.current++ }].slice(-3));
  }, []);

  useEffect(() => {
    if (data === undefined) return;
    const now = new Map(data.companies.map((company) => [company.cik, company.state]));
    const was = before.current;
    before.current = now;
    if (was === null) return;
    let changed = false;
    for (const company of data.companies) {
      const previous = was.get(company.cik);
      if (previous !== "waiting" && previous !== "collecting") continue;
      if (company.state === "ready") {
        changed = true;
        const asked = awaited?.cik === company.cik ? awaited : null;
        if (asked !== null) awaited = null;
        if (asked !== null && here.current === asked.path) {
          void navigate({ to: "/$ticker/overview", params: { ticker: company.ticker } });
        } else {
          push({ company, text: `${plainName(company.name)} is ready.`, link: "open" });
        }
      } else if (company.state === "failed") {
        changed = true;
        push({ company, text: `${plainName(company.name)} could not be collected.`, link: "why" });
      }
    }
    if (changed) {
      void queryClient.invalidateQueries({ queryKey: ["company"] });
      void queryClient.invalidateQueries({ queryKey: ["companies", "search"] });
    }
  }, [data, queryClient, push, navigate]);

  const dismiss = (id: number) => setNotices((list) => list.filter((notice) => notice.id !== id));

  return (
    <NoticeContext.Provider value={push}>
      {children}
      <div className="notices" role="status" aria-live="polite">
        {notices.map((notice) => (
          <NoticeCard key={notice.id} notice={notice} dismiss={() => dismiss(notice.id)} />
        ))}
      </div>
    </NoticeContext.Provider>
  );
}

function NoticeCard({
  notice,
  dismiss,
}: {
  readonly notice: Notice;
  readonly dismiss: () => void;
}) {
  const held = useRef(false);
  const latestDismiss = useRef(dismiss);
  latestDismiss.current = dismiss;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const wait = () => {
      timer = setTimeout(() => (held.current ? wait() : latestDismiss.current()), 9000);
    };
    wait();
    return () => clearTimeout(timer);
  }, []);
  const hold = (value: boolean) => () => (held.current = value);
  return (
    <div
      className="notice"
      onMouseEnter={hold(true)}
      onMouseLeave={hold(false)}
      onFocus={hold(true)}
      onBlur={hold(false)}
    >
      <LogoTile name={plainName(notice.company.name)} cik={notice.company.cik} size={32} />
      <p>{notice.text}</p>
      {notice.link === "open" && (
        <Link
          to="/$ticker/where-the-money-goes"
          params={{ ticker: notice.company.ticker }}
          onClick={dismiss}
        >
          Open
        </Link>
      )}
      {notice.link === "why" && (
        <Link to="/companies" onClick={dismiss}>
          See why
        </Link>
      )}
      <button type="button" className="close" aria-label="Dismiss" onClick={dismiss}>
        <Icon name="close" className="h-4 w-4" />
      </button>
    </div>
  );
}
