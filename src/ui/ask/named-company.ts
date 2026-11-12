import { findCompanyIn } from "../../functions/companies";
import { allTerms } from "../../glossary/glossary";

export const termWords = [
  ...new Set(allTerms.flatMap((term) => term.name.toLowerCase().split(/[^a-z]+/))),
].filter((word) => word.length >= 3);

export const namedCompanyQuery = (text: string) => ({
  queryKey: ["home", "company", text],
  queryFn: () => findCompanyIn({ data: { text, skip: termWords } }),
  staleTime: 60_000,
});
