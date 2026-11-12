const loopback = new Set(["127.0.0.1", "localhost", "[::1]"]);

export const fromThisComputer = (request: Request) => {
  const url = new URL(request.url);
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  return (
    loopback.has(url.hostname) &&
    (origin === null || origin === url.origin) &&
    (site === null || site === "same-origin" || site === "none") &&
    (request.method !== "POST" ||
      (request.headers.get("content-type") ?? "").startsWith("application/json"))
  );
};

export const lookupsUrlFor = (request: Request) =>
  `http://127.0.0.1:${new URL(request.url).port || "4100"}/api/lookup`;

export const refused = () =>
  Response.json({ error: "Only this computer may ask." }, { status: 403 });
