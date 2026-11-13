import { Link, type ErrorComponentProps, useRouter } from "@tanstack/react-router";

export function ScreenBroke({ reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <main className="page">
      <h1 className="m-0 text-xl font-semibold">This screen could not open</h1>
      <p className="text-text-2">
        The tool ran into a problem it did not expect. Nothing you collected was changed.
      </p>
      <div className="actions justify-start">
        <button
          type="button"
          className="button primary"
          onClick={() => {
            void router.invalidate();
            reset();
          }}
        >
          Try again
        </button>
        <Link className="button" to="/companies">
          Go to Companies
        </Link>
      </div>
    </main>
  );
}
