import { createFileRoute } from "@tanstack/react-router";
import { fromThisComputer, refused } from "../../server/agent/local-request";
import { lookUp } from "../../server/agent/look-up";
import { catalog } from "../../server/agent/lookups";
import { runtime } from "../../server/runtime";

export const Route = createFileRoute("/api/lookup")({
  server: {
    handlers: {
      GET: ({ request }) => (fromThisComputer(request) ? Response.json(catalog) : refused()),
      POST: async ({ request }) => {
        if (!fromThisComputer(request)) return refused();
        const body = (await request.json().catch(() => null)) as {
          name?: unknown;
          input?: unknown;
        } | null;
        if (body === null || typeof body.name !== "string") {
          return Response.json({ error: "Send a lookup name and its input." }, { status: 400 });
        }
        return Response.json(await runtime.runPromise(lookUp(body.name, body.input)));
      },
    },
  },
});
