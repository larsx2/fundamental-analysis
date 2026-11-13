import { describe, expect, it } from "@effect/vitest";
import type { LookupResult } from "../../shared/lookups";
import { apply, empty } from "./use-ask";

describe("what the screen keeps of a lookup", () => {
  const reading = apply(empty, {
    type: "reading",
    id: "call-1",
    lookup: "trend",
    input: { ticker: "COST" },
  });

  it("keeps the input it was asked with once the lookup is read", () => {
    const state = apply(reading, {
      type: "read",
      id: "call-1",
      lookup: "trend",
      result: {
        lookup: "trend",
        figures: [],
        filings: [],
      } as unknown as LookupResult,
      error: null,
    });
    expect(state.lookups).toHaveLength(1);
    expect(state.lookups[0]).toMatchObject({
      input: { ticker: "COST" },
      status: "read",
    });
  });

  it("marks the lookup failed when it gives no result", () => {
    const state = apply(reading, {
      type: "read",
      id: "call-1",
      lookup: "trend",
      result: null,
      error: "The lookup gave nothing back.",
    });
    expect(state.lookups[0]).toMatchObject({
      input: { ticker: "COST" },
      status: "failed",
    });
  });
});
