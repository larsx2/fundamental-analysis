import { describe, expect, it } from "@effect/vitest";
import { paragraphsOf, riskHeadings } from "./report-text";

const long = (topic: string) =>
  `Our ${topic} could change in ways we cannot predict, and any such change could adversely affect our business, our results of operations, our financial condition and the price of our stock, as described in more detail in the paragraphs that follow in this section of the report.`;

const contents = `<div>Item 1A.</div><div>Risk Factors</div><div>Item 1B.</div><div>Unresolved Staff Comments</div>`;

const ownLines = `${contents}
  <div>Item 1A. Risk Factors</div>
  <p>${long("markets")}</p>
  <p>We face intense competition in every market we serve.</p>
  <p>${long("competitors")}</p>
  <p>Our suppliers may fail to deliver parts on time.</p>
  <p>${long("suppliers")}</p>
  <div>Item 1B. Unresolved Staff Comments</div>
  <p>None of the staff comments remain unresolved at the end of the year covered by this report.</p>`;

const boldOpenings = `${contents}
  <div>Item 1A. Risk Factors</div>
  <p>${long("markets")}</p>
  <p><span style="font-weight:bold">We face intense competition in every market we serve</span><span>. ${long("competitors")}</span></p>
  <p><span style="font-weight:bold">Our suppliers may fail to deliver parts on time</span><span>. ${long("suppliers")}</span></p>
  <p>${long("costs")}</p>
  <p>${long("customers")}</p>
  <div>Item 1B. Unresolved Staff Comments</div>`;

const headingTexts = (html: string) => {
  const paragraphs = paragraphsOf(html);
  return paragraphs.filter((each) => each.heading).map((each) => each.text.slice(0, 30));
};

describe("risk headings", () => {
  it("finds headings set as their own short line, not the table of contents", () => {
    expect(headingTexts(ownLines)).toEqual([
      "We face intense competition in",
      "Our suppliers may fail to deli",
    ]);
  });

  it("finds headings set in bold at the start of their paragraph", () => {
    expect(headingTexts(boldOpenings)).toEqual([
      "We face intense competition in",
      "Our suppliers may fail to deli",
    ]);
  });

  it("finds none when the report has no risk factors section", () => {
    expect(riskHeadings(`<p>${long("markets")}</p>`)).toEqual([]);
  });
});

describe("report paragraphs", () => {
  it("keeps prose and leaves out table rows of figures", () => {
    const html = `<p>${long("markets")}</p><table><tr><td>2026 2025 2024 $ 1,234 $ 1,111 $ 987</td></tr></table>`;
    expect(paragraphsOf(html).map((each) => each.text)).toEqual([long("markets")]);
  });
});

const span = (style: string, text: string) => `<div><span style="${style}">${text}</span></div>`;
const body = (text: string) => span("font-size:10pt", text);
const footer = (page: number) =>
  `${span("font-size:8pt", "MD&A")}<div>${page}</div>${span("font-size:8pt", "Table of Contents")}`;

const discussion = [
  span("font-size:18pt", "Results of Operations"),
  body(long("revenue")),
  footer(20),
  span("font-size:14pt", "Revenue"),
  span("font-size:10pt;font-weight:bold", "2026 vs. 2025"),
  body(
    "Revenue was roughly flat, as lower client revenue was offset by higher data center revenue.",
  ),
  footer(21),
  span("font-size:14pt", "Operating Expenses"),
  body("The following table shows our operating expenses for each of the last two years."),
  "<table><tr><td>Research and development spending</td><td>1,234</td><td>1,111</td></tr></table>",
  span("font-size:10pt;font-weight:bold", "2026 vs. 2025"),
  body("Research and development expenses decreased because of lower payroll costs this year."),
  footer(22),
  body("(In millions, except per share amounts)"),
].join("");

const sectionOf = (html: string, start: string) =>
  paragraphsOf(html).find((each) => each.text.startsWith(start))?.section;

describe("report sections", () => {
  it("gives each paragraph the headings above it, nested by how prominently they are set", () => {
    expect(sectionOf(discussion, "Revenue was roughly flat")).toBe(
      "Results of Operations › Revenue › 2026 vs. 2025",
    );
    expect(sectionOf(discussion, "Research and development expenses")).toBe(
      "Results of Operations › Operating Expenses › 2026 vs. 2025",
    );
  });

  it("leaves out page headers and footers, table labels, captions and the headings themselves", () => {
    const texts = paragraphsOf(discussion).map((each) => each.text);
    expect(texts).toHaveLength(4);
    expect(
      texts.some((text) => /Table of Contents|MD&A|Research and development spending/.test(text)),
    ).toBe(false);
    expect(texts.some((text) => text.startsWith("(In millions"))).toBe(false);
  });
});
