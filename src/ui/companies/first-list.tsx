import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { fetchCompanyList, saveContact } from "../../functions/companies";

// Before anything else the tool needs the SEC's list of companies, and the
// SEC asks for contact details before it answers.
export function FirstList({ contactGiven }: { readonly contactGiven: boolean }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fetchList = async () => {
    setProblem(null);
    if (!contactGiven && (name.trim() === "" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) {
      setProblem("Enter your name and an email address, such as name@example.com.");
      return;
    }
    setBusy(true);
    try {
      if (!contactGiven) {
        await saveContact({ data: { name: name.trim(), email: email.trim() } });
      }
      const answer = await fetchCompanyList();
      if (!answer.ok) setProblem(answer.reason);
      await queryClient.invalidateQueries({ queryKey: ["companies"] });
    } catch {
      setProblem("The tool could not fetch the list. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="panel welcome mt-0" aria-labelledby="first-title">
      <h2 id="first-title">First, the list of public companies</h2>
      <p>
        To search every public company, the tool fetches the SEC's list of names and tickers once.
        {contactGiven
          ? ""
          : " The SEC asks every program that fetches its data to name the person sending the requests, so these go only to the SEC and stay on this computer."}
      </p>
      <form
        className="mt-5 grid max-w-[460px] gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          void fetchList();
        }}
      >
        {!contactGiven && (
          <>
            <div className="field">
              <label htmlFor="first-name">Name</label>
              <input
                id="first-name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="first-email">Email</label>
              <input
                id="first-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
          </>
        )}
        {problem !== null && (
          <p className="field-message" role="alert">
            {problem}
          </p>
        )}
        <div>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Fetching the list" : "Fetch the list"}
          </button>
        </div>
      </form>
    </section>
  );
}
