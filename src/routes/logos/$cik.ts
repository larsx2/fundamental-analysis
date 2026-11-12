import { createFileRoute } from "@tanstack/react-router";
import { logoResponse } from "../../functions/logos";

export const Route = createFileRoute("/logos/$cik")({
  server: {
    handlers: {
      GET: ({ params }) => logoResponse(params.cik),
    },
  },
});
