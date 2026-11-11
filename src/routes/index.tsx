import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { secContactQuery } from "../functions/settings";

export const Route = createFileRoute("/")({
  // Fetch before the page is drawn, so it never flashes an empty value.
  loader: ({ context }) => context.queryClient.ensureQueryData(secContactQuery),
  component: CompaniesPage,
});

function CompaniesPage() {
  const { data } = useSuspenseQuery(secContactQuery);

  return (
    <main>
      <h1>Companies</h1>
      <p>No companies collected yet.</p>
      <p>Contact details for the SEC: {data.secContact ?? "not given yet"}</p>
    </main>
  );
}
