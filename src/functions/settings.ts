import { queryOptions } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { Effect, Option } from "effect";
import { runtime } from "../server/runtime";
import { Settings, secContactKey } from "../server/settings";

const getSecContact = createServerFn({ method: "GET" }).handler(() =>
  runtime.runPromise(
    Effect.gen(function* () {
      const settings = yield* Settings;
      const contact = yield* settings.get(secContactKey);
      return { secContact: Option.getOrNull(contact) };
    }),
  ),
);

export const secContactQuery = queryOptions({
  queryKey: ["settings", secContactKey],
  queryFn: () => getSecContact(),
});
