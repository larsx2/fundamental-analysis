import { describe, expect, it } from "vitest";
import { addressedToThisComputer, fromThisComputer, lookupsUrlFor } from "./local-request";

const request = (
  url: string,
  headers: Record<string, string> = {},
  method: "GET" | "POST" = "POST",
) =>
  new Request(url, {
    method,
    headers: { "content-type": "application/json", ...headers },
    ...(method === "POST" ? { body: "{}" } : {}),
  });

describe("only this computer may ask", () => {
  it("accepts the tool's own pages on this computer", () => {
    expect(
      fromThisComputer(
        request("http://127.0.0.1:4100/api/ask", {
          origin: "http://127.0.0.1:4100",
          "sec-fetch-site": "same-origin",
        }),
      ),
    ).toBe(true);
    expect(fromThisComputer(request("http://localhost:4100/api/ask"))).toBe(true);
  });

  it("turns away another site, even one open on this computer", () => {
    expect(
      fromThisComputer(
        request("http://127.0.0.1:4100/api/ask", {
          origin: "https://example.com",
          "sec-fetch-site": "cross-site",
        }),
      ),
    ).toBe(false);
    expect(
      fromThisComputer(
        request("http://127.0.0.1:4100/api/ask", {
          "sec-fetch-site": "same-site",
        }),
      ),
    ).toBe(false);
  });

  it("turns away a page on another port of this computer, even when the browser sends only its origin", () => {
    expect(
      fromThisComputer(
        request("http://127.0.0.1:4100/api/ask", { origin: "http://localhost:3000" }),
      ),
    ).toBe(false);
  });

  it("lets a plain request for the lookup list through, whatever it says it carries", () => {
    expect(
      fromThisComputer(
        request("http://127.0.0.1:4100/api/lookup", { "content-type": "text/plain" }, "GET"),
      ),
    ).toBe(true);
  });

  it("turns away a request addressed to any other name", () => {
    expect(fromThisComputer(request("http://attacker.example:4100/api/ask"))).toBe(false);
    expect(addressedToThisComputer(request("http://192.168.1.20:4100/companies"))).toBe(false);
    expect(addressedToThisComputer(request("http://[::1]:4100/companies"))).toBe(true);
  });

  it("turns away a question sent as a form, which another site can send without asking", () => {
    expect(
      fromThisComputer(
        request("http://127.0.0.1:4100/api/ask", {
          "content-type": "text/plain",
        }),
      ),
    ).toBe(false);
  });

  it("points Codex at the lookups on the port the tool runs on", () => {
    expect(lookupsUrlFor(request("http://127.0.0.1:4120/api/ask"))).toBe(
      "http://127.0.0.1:4120/api/lookup",
    );
  });
});
