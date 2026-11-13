import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { Server as HttpServer } from "node:http";
import { Server } from "node:net";

const local = new Set(["127.0.0.1", "localhost", "[::1]"]);
const log = "data/no-network.log";
const day = 24 * 60 * 60 * 1000;
const dateOf = (millis: number) => new Date(millis).toISOString().slice(0, 10);

mkdirSync("data", { recursive: true });
const note = (line: string) => appendFileSync(log, `${line}\n`);

const submissions = {
  name: "EXAMPLE CORP",
  sic: "3571",
  filings: {
    recent: {
      accessionNumber: ["0000000001-26-000001"],
      filingDate: [dateOf(Date.now() - 40 * day)],
      reportDate: [dateOf(Date.now() - 100 * day)],
      form: ["10-K"],
      items: [""],
      primaryDocument: ["report.htm"],
    },
    files: [],
  },
};

const real = globalThis.fetch;
const reply = (body: unknown) => Response.json(body);

globalThis.fetch = Object.assign(
  async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (local.has(url.hostname)) return real(input, init);
    if (url.href === "https://data.sec.gov/submissions/CIK0000000001.json") {
      note(`answered ${url.href}`);
      return reply(submissions);
    }
    if (url.href === "https://data.sec.gov/api/xbrl/companyfacts/CIK0000000001.json") {
      note(`answered ${url.href}`);
      return reply(
        JSON.parse(
          readFileSync("src/server/testdata/microsoft.json", "utf8").replace(
            /"accn": ?"/g,
            '"accn":"example-',
          ),
        ),
      );
    }
    note(`refused ${url.href}`);
    return new Response("Nothing here in tests.", { status: 404 });
  },
  { preconnect: () => {} },
) as typeof fetch;

note(`outside requests are answered by the fake in process ${process.pid}`);

for (const kind of [Server, HttpServer]) {
  const listen = Reflect.get(kind.prototype, "listen") as (
    this: Server,
    ...args: Array<unknown>
  ) => Server;
  kind.prototype.listen = function (this: Server, ...args: Array<unknown>) {
    this.once("listening", () => {
      const address = this.address();
      if (address !== null && typeof address === "object") {
        note(`listening on port ${address.port} with the fake in process ${process.pid}`);
      }
    });
    return listen.apply(this, args);
  } as typeof listen;
}
