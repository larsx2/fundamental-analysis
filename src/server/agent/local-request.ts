const loopback = new Set(["127.0.0.1", "localhost", "[::1]"]);

export const fromThisComputer = (request: Request) => loopback.has(new URL(request.url).hostname);

export const lookupsUrlFor = (request: Request) =>
  `http://127.0.0.1:${new URL(request.url).port || "4100"}/api/lookup`;

export const refused = () =>
  Response.json({ error: "Only this computer may ask." }, { status: 403 });
