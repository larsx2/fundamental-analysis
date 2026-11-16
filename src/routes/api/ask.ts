import { createFileRoute } from "@tanstack/react-router";
import { Effect, Stream } from "effect";
import { findCompany } from "../../server/company-view";
import { ask, warm } from "../../server/agent/ask";
import { lookUp } from "../../server/agent/look-up";
import { fromThisComputer, lookupsUrlFor, refused } from "../../server/local-request";
import { runtime } from "../../server/runtime";

export const Route = createFileRoute("/api/ask")({
  server: {
    handlers: {
      GET: ({ request }) => {
        if (!fromThisComputer(request)) return refused();
        runtime.runFork(warm(lookupsUrlFor(request)));
        return new Response(null, { status: 204 });
      },
      POST: async ({ request }) => {
        if (!fromThisComputer(request)) return refused();
        const body = (await request.json().catch(() => null)) as {
          ticker?: unknown;
          tickers?: unknown;
          question?: unknown;
          year?: unknown;
          earlier?: unknown;
        } | null;
        const question =
          typeof body?.question === "string" ? body.question.trim().slice(0, 1000) : "";
        const tickers = [
          ...new Set(
            (Array.isArray(body?.tickers) ? body.tickers : [body?.ticker])
              .filter((each: unknown): each is string => typeof each === "string" && each !== "")
              .map((each: string) => each.toUpperCase())
              .slice(0, 4),
          ),
        ];
        const earlier = Array.isArray(body?.earlier)
          ? body.earlier
              .flatMap((each: unknown) =>
                typeof each === "object" &&
                each !== null &&
                "question" in each &&
                "answer" in each &&
                typeof each.question === "string" &&
                typeof each.answer === "string"
                  ? [{ question: each.question.slice(0, 500), answer: each.answer.slice(0, 1500) }]
                  : [],
              )
              .slice(-6)
          : [];
        const fiscalYear =
          typeof body?.year === "number" && Number.isInteger(body.year) ? body.year : null;
        if (question === "") {
          return Response.json({ error: "Send a question." }, { status: 400 });
        }
        const companies: Array<{ name: string; ticker: string }> = [];
        for (const ticker of tickers) {
          const row = await runtime.runPromise(findCompany(ticker));
          if (row === null || row.state !== "ready") {
            return Response.json({ error: `${ticker} is not ready.` }, { status: 409 });
          }
          companies.push({ name: row.name, ticker: row.ticker ?? ticker.toUpperCase() });
        }
        const encoder = new TextEncoder();
        // The answer stops when the reader leaves, which stops Codex's turn.
        const left = Effect.callback<void>((resume) => {
          if (request.signal.aborted) return resume(Effect.void);
          const leave = () => resume(Effect.void);
          request.signal.addEventListener("abort", leave, { once: true });
          return Effect.sync(() => request.signal.removeEventListener("abort", leave));
        });
        const stream = await runtime.runPromise(
          ask({
            question,
            companies,
            fiscalYear,
            earlier,
            lookupsUrl: lookupsUrlFor(request),
            read: lookUp,
          }).pipe(
            Stream.map((event) => encoder.encode(`${JSON.stringify(event)}\n`)),
            Stream.interruptWhen(left),
            Stream.toReadableStreamEffect(),
          ),
        );
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
