import { Effect, Option } from "effect";
import { Logos } from "../server/logos";
import { runtime } from "../server/runtime";

// A company's logo, kept on this computer when the company was collected.
// A company without one answers "not found", and the screen shows its letter.
export const logoResponse = async (cik: string) => {
  if (!/^\d{1,10}$/.test(cik)) return new Response(null, { status: 404 });
  const found = await runtime.runPromise(
    Effect.gen(function* () {
      const logos = yield* Logos;
      return yield* logos.logo(Number(cik));
    }),
  );
  if (Option.isNone(found)) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(found.value.image), {
    headers: {
      "Content-Type": found.value.type,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
    },
  });
};
