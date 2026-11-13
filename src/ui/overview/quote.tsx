import { filingUrl, longDate } from "../../shared/format";
import type { ReadyCompany } from "../company-frame";
import { shortName } from "../logo-tile";
import { GapMark } from "../marks";
import { Term } from "../term";

// In its own words: the opening of the business description in its latest
// annual report, kept short so it never outweighs the numbers.
export function Quote({ view, latest }: { readonly view: ReadyCompany; readonly latest: boolean }) {
  const description = view.details.description;
  const name = shortName(view.name);
  if (description === null) {
    return (
      <section className="quote" aria-labelledby="quote-title">
        <h2 className="eyebrow m-0 font-normal" id="quote-title">
          In its own words
        </h2>
        <p className="mt-2 mb-0 text-s text-text-3">
          The business description in {name}'s{" "}
          <Term name="Annual report (10-K)">annual report (10-K)</Term> is a <GapMark />: the tool
          could not find its opening yet.
        </p>
      </section>
    );
  }
  const url = filingUrl(view.cik, description.accession, description.document);
  return (
    <section className="quote" aria-labelledby="quote-title">
      <h2 className="eyebrow m-0 font-normal" id="quote-title">
        In its own words
      </h2>
      <blockquote cite={url}>
        <p>{description.text}</p>
      </blockquote>
      <p className="source">
        From its {latest ? "" : "latest "}
        <Term name="Annual report (10-K)">annual report (10-K)</Term>, filed on{" "}
        {longDate(description.filedOn)}.{" "}
        <a href={url} target="_blank" rel="noreferrer">
          Read it in the filing {"↗"}
        </a>
      </p>
    </section>
  );
}
