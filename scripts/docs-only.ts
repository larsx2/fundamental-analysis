// Files only people and agents read. A push to main that changes nothing else
// needs only the formatting check. No code may read these, and a test fails if
// any code mentions one, so a doc that code needs has to come off this list.
// GLOSSARY.md is never on it: the glossary screen is built from it.
export const docs = [
  "docs/adr/*.md",
  "docs/rfc/*.md",
  "docs/learning-effect.md",
  "docs/pictures/*.png",
  "README.md",
  "CONTRIBUTING.md",
  "AGENTS.md",
  "evals/README.md",
  "field-map.md",
  "todo.md",
] as const;

const patterns = docs.map(
  (doc) => new RegExp(`^${doc.replaceAll(".", "\\.").replace("*", "[^/]+")}$`),
);

export const isDoc = (path: string) => patterns.some((pattern) => pattern.test(path));
