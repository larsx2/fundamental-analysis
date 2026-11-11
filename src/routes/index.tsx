import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: CompaniesPage,
});

function CompaniesPage() {
  return (
    <main>
      <h1>Companies</h1>
      <p>No companies collected yet.</p>
    </main>
  );
}
