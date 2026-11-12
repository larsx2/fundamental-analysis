import { createFileRoute } from "@tanstack/react-router";
import { Conversation } from "../ui/ask/conversation";
import { OwnFigures } from "../ui/term";

export const Route = createFileRoute("/ask")({
  validateSearch: (search: Record<string, unknown>): { q?: string; t?: string; c?: string } => ({
    ...(typeof search.q === "string" && search.q.trim() !== "" ? { q: search.q.trim() } : {}),
    ...(typeof search.t === "string" && search.t !== "" ? { t: search.t } : {}),
    ...(typeof search.c === "string" && /^[A-Za-z0-9.,-]+$/.test(search.c) ? { c: search.c } : {}),
  }),
  component: NewConversation,
});

const noFigures = () => null;

function NewConversation() {
  const { q, t, c } = Route.useSearch();
  return (
    <OwnFigures figure={noFigures}>
      <Conversation
        start={null}
        q={q}
        t={t}
        c={c === undefined ? [] : c.split(",").filter(Boolean)}
      />
    </OwnFigures>
  );
}
