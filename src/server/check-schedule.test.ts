import { describe, expect, it } from "vitest";
import { isDueForCheck } from "./check-schedule";

// Apple's fiscal 2025 ended on 27 September 2025.
const yearEndOn = "2025-09-27";

describe("isDueForCheck", () => {
  it("checks a company that was never checked", () => {
    expect(isDueForCheck({ lastCheckedOn: null, yearEndOn, today: "2026-03-01" })).toBe(true);
  });

  it("checks once a month away from the next annual report", () => {
    const today = "2026-03-01";
    expect(isDueForCheck({ lastCheckedOn: "2026-01-29", yearEndOn, today })).toBe(true);
    expect(isDueForCheck({ lastCheckedOn: "2026-02-15", yearEndOn, today })).toBe(false);
  });

  it("checks every week from the next fiscal year end until the report is due", () => {
    const today = "2026-10-20";
    expect(isDueForCheck({ lastCheckedOn: "2026-10-12", yearEndOn, today })).toBe(true);
    expect(isDueForCheck({ lastCheckedOn: "2026-10-17", yearEndOn, today })).toBe(false);
  });

  it("goes back to once a month once the report is overdue", () => {
    const today = "2027-02-01";
    expect(isDueForCheck({ lastCheckedOn: "2027-01-20", yearEndOn, today })).toBe(false);
  });

  it("checks once a month when the fiscal year end is not known", () => {
    const today = "2026-10-20";
    expect(isDueForCheck({ lastCheckedOn: "2026-10-12", yearEndOn: null, today })).toBe(false);
    expect(isDueForCheck({ lastCheckedOn: "2026-09-01", yearEndOn: null, today })).toBe(true);
  });
});
