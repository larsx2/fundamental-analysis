import { Dialog } from "@base-ui/react/dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useId,
  useRef,
  useState,
} from "react";
import { collectCompany, companiesQuery, saveContact } from "../functions/companies";
import { plainName } from "./logo-tile";
import { openWhenReady } from "./notices";

export type Collectable = { readonly cik: number; readonly name: string };

type Ask = (company: Collectable, options?: { readonly open?: boolean }) => void;

const CollectContext = createContext<Ask>(() => {});

// Asks before collecting, and the first time also asks for the contact
// details the SEC requires. Any screen can ask to collect a company.
export const useAskToCollect = () => useContext(CollectContext);

type Open =
  | { readonly kind: "collect"; readonly company: Collectable; readonly open: boolean }
  | {
      readonly kind: "not covered";
      readonly company: Collectable;
      readonly reason: string;
    };

const emailShape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CollectProvider({ children }: { readonly children: ReactNode }) {
  // What the sheet shows stays until it has finished closing. Emptying it at
  // once leaves the closing backdrop over the page, and nothing can be clicked.
  const [open, setOpen] = useState<Open | null>(null);
  const [showing, setShowing] = useState(false);
  const ask = useCallback<Ask>((company, options) => {
    setOpen({ kind: "collect", company, open: options?.open === true });
    setShowing(true);
  }, []);
  const close = () => setShowing(false);
  return (
    <CollectContext.Provider value={ask}>
      {children}
      <Dialog.Root
        open={showing}
        onOpenChange={(next) => !next && close()}
        onOpenChangeComplete={(next) => !next && setOpen(null)}
      >
        <Dialog.Portal>
          <Dialog.Backdrop className="sheet-backdrop" />
          {open?.kind === "collect" && (
            <CollectSheet
              company={open.company}
              openOnReady={open.open}
              close={close}
              notCovered={(reason) =>
                setOpen({ kind: "not covered", company: open.company, reason })
              }
            />
          )}
          {open?.kind === "not covered" && (
            <Dialog.Popup className="sheet">
              <Dialog.Title render={<h2 />}>
                {plainName(open.company.name)} is not covered
              </Dialog.Title>
              <Dialog.Description render={<div />}>
                <p>{open.reason}</p>
                <p>
                  The first version covers companies that file an annual report (10-K), except
                  banks, insurers and property trusts.
                </p>
              </Dialog.Description>
              <div className="actions">
                <Dialog.Close className="button primary">Close</Dialog.Close>
              </div>
            </Dialog.Popup>
          )}
        </Dialog.Portal>
      </Dialog.Root>
    </CollectContext.Provider>
  );
}

function CollectSheet({
  company,
  openOnReady,
  close,
  notCovered,
}: {
  readonly company: Collectable;
  readonly openOnReady: boolean;
  readonly close: () => void;
  readonly notCovered: (reason: string) => void;
}) {
  const queryClient = useQueryClient();
  const { data } = useQuery(companiesQuery);
  const known = data?.contact ?? null;
  const [changing, setChanging] = useState(false);
  const asking = known === null || changing;
  const [name, setName] = useState(known?.name ?? "");
  const [email, setEmail] = useState(known?.email ?? "");
  const [problems, setProblems] = useState<{
    name?: string;
    email?: string;
    send?: string;
  }>({});
  const [sending, setSending] = useState(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const emailInput = useRef<HTMLInputElement>(null);
  const go = useRef<HTMLButtonElement>(null);
  const ids = useId();
  const shown = plainName(company.name);
  const line = (data?.companies ?? []).filter(
    (each) => each.state === "waiting" || each.state === "collecting",
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (asking) {
      const found = {
        ...(name.trim() === "" ? { name: "Enter your name, as the SEC should see it." } : {}),
        ...(emailShape.test(email.trim())
          ? {}
          : { email: "Enter an email address, such as name@example.com." }),
      };
      setProblems(found);
      if (found.name !== undefined) return nameInput.current?.focus();
      if (found.email !== undefined) return emailInput.current?.focus();
    }
    setSending(true);
    try {
      if (asking) await saveContact({ data: { name: name.trim(), email: email.trim() } });
      const answer = await collectCompany({ data: { cik: company.cik } });
      const started = answer.answer !== "not covered" && answer.answer !== "could not ask";
      if (started && openOnReady) openWhenReady(company.cik);
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
      await queryClient.invalidateQueries({ queryKey: ["company"] });
      if (answer.answer === "not covered") return notCovered(answer.reason);
      if (answer.answer === "could not ask") {
        setProblems({ send: answer.reason });
        return;
      }
      close();
    } catch {
      setProblems({
        send: "The tool could not start collecting. Try again in a moment.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog.Popup
      className="sheet"
      initialFocus={asking ? nameInput : go}
      render={<form onSubmit={submit} noValidate />}
    >
      <Dialog.Title render={<h2 />}>Collect {shown}?</Dialog.Title>
      <Dialog.Description render={<div />}>
        <p>
          The tool will ask the SEC for {shown}'s annual reports (10-K), check the reported numbers
          in them, and keep them on this computer.
        </p>
        <ul className="facts">
          <li>
            {line.length === 0
              ? "It is usually ready within seconds."
              : `It waits in line behind ${line.length === 1 ? plainName(line[0]!.name) : `${line.length} companies`}, because they all share the SEC's limit of ten requests a second.`}
          </li>
          <li>It runs in the background, so you can keep reading.</li>
          <li>You can remove it at any time.</li>
        </ul>
      </Dialog.Description>
      {asking ? (
        <fieldset>
          <legend>Your contact details for the SEC</legend>
          <p>
            The SEC asks every program that fetches its filings to name the person sending the
            requests, so these go only to the SEC and stay on this computer.
          </p>
          <div className="field">
            <label htmlFor={`${ids}-name`}>Name</label>
            <input
              ref={nameInput}
              id={`${ids}-name`}
              autoComplete="name"
              value={name}
              aria-invalid={problems.name !== undefined || undefined}
              aria-describedby={`${ids}-name-message`}
              onChange={(event) => setName(event.target.value)}
            />
            <p className="field-message" id={`${ids}-name-message`}>
              {problems.name}
            </p>
          </div>
          <div className="field">
            <label htmlFor={`${ids}-email`}>Email</label>
            <input
              ref={emailInput}
              id={`${ids}-email`}
              type="email"
              autoComplete="email"
              value={email}
              aria-invalid={problems.email !== undefined || undefined}
              aria-describedby={`${ids}-email-message`}
              onChange={(event) => setEmail(event.target.value)}
            />
            <p className="field-message" id={`${ids}-email-message`}>
              {problems.email}
            </p>
          </div>
        </fieldset>
      ) : (
        <p>
          The requests carry your contact details
          {known.name !== "" && known.email !== "" ? `, ${known.name} at ${known.email}` : ""}.{" "}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setChanging(true);
              requestAnimationFrame(() => nameInput.current?.focus());
            }}
          >
            Change them
          </button>
        </p>
      )}
      {problems.send !== undefined && (
        <p className="field-message" role="alert">
          {problems.send}
        </p>
      )}
      <div className="actions">
        <Dialog.Close className="button" type="button">
          Cancel
        </Dialog.Close>
        <button type="submit" className="button primary" ref={go} disabled={sending}>
          {asking ? "Save and collect" : "Collect"}
        </button>
      </div>
    </Dialog.Popup>
  );
}
