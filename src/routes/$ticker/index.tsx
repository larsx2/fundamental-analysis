import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/$ticker/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/$ticker/overview", params: { ticker: params.ticker } });
  },
});
