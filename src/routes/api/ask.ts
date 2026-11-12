import { createFileRoute } from "@tanstack/react-router";
import { findCompany } from "../../server/company-view";
import { ask } from "../../server/agent/ask";
import { fromThisComputer, lookupsUrlFor, refused } from "../../server/agent/local-request";
import { runtime } from "../../server/runtime";

export const Route = createFileRoute("/api/ask")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!fromThisComputer(request)) return refused();
        const body = (await request.json().catch(() => null)) as {
          ticker?: unknown;
          question?: unknown;
        } | null;
        const question = typeof body?.question === "string" ? body.question.trim() : "";
        const ticker = typeof body?.ticker === "string" ? body.ticker : "";
        if (question === "" || ticker === "") {
          return Response.json({ error: "Send a ticker and a question." }, { status: 400 });
        }
        const row = await runtime.runPromise(findCompany(ticker));
        if (row === null || row.state !== "ready") {
          return Response.json({ error: `${ticker} is not ready.` }, { status: 409 });
        }
        const encoder = new TextEncoder();
        const events = ask({
          question,
          company: {
            name: row.name,
            ticker: row.ticker ?? ticker.toUpperCase(),
          },
          lookupsUrl: lookupsUrlFor(request),
          signal: request.signal,
        });
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for await (const event of events) {
                controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
              }
              controller.close();
            } catch {
              await events.return(undefined);
            }
          },
        });
        return new Response(stream, {
          headers: {
            "content-type": "application/x-ndjson",
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
