import { describe, expect, it } from "vitest";
import { openingOfBusiness } from "./business-description";

// The shape of Apple's annual report: a table of contents that names "Item 1.
// Business" first, then the section itself with a short sub-heading.
const annualReport = `
<html><body>
<ix:header><div style="display:none">hidden tagged facts</div></ix:header>
<table>
  <tr><td>Item 1.</td><td>Business</td><td>1</td></tr>
  <tr><td>Item 1A.</td><td>Risk Factors</td><td>5</td></tr>
</table>
<div><span>Item 1.&#160;&#160;&#160;&#160;Business</span></div>
<div><span>Company Background</span></div>
<div><span>The Company designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories, and sells a variety of related services. The Company&#8217;s fiscal year is the 52- or 53-week period that ends on the last Saturday of September.</span></div>
<div><span>Products</span></div>
</body></html>`;

describe("the opening of a company's own business description", () => {
  it("skips the table of contents and stops before the sentence about the fiscal year", () => {
    expect(openingOfBusiness(annualReport)).toBe(
      "The Company designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories, and sells a variety of related services.",
    );
  });

  it("keeps a number that names no character as written, rather than failing", () => {
    expect(
      openingOfBusiness(
        annualReport.replace("Company Background", "Company &#99999999; Background"),
      ),
    ).toContain("The Company designs");
  });
});
