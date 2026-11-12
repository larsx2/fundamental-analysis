import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { chooseLogo, type LogoClaim } from "./logos";

// Wikidata's records of Microsoft's logos, as fetched on 11 November 2026:
// four full logos from 1980, 1982, 1987 and 2012, and one small icon.
const claims = JSON.parse(
  readFileSync(new URL("testdata/microsoft-logo-claims.json", import.meta.url), "utf8"),
) as Record<"P154" | "P8972", { claims: Record<string, ReadonlyArray<LogoClaim>> }>;
const logos = claims.P154.claims["P154"] ?? [];
const icons = claims.P8972.claims["P8972"] ?? [];

describe("choosing a company's logo from Wikidata", () => {
  it("takes the small icon, which fits a square tile, over the full logo", () => {
    expect(chooseLogo(icons, logos)).toBe("Microsoft icon.svg");
  });

  it("takes the logo in use today, not the 1980 one listed first", () => {
    expect(chooseLogo([], logos)).toBe("Microsoft logo (2012).svg");
  });
});
