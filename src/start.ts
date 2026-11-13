import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start";
import { addressedToThisComputer, refused } from "./server/agent/local-request";

const onlyThisComputer = createMiddleware().server(({ request, next }) =>
  addressedToThisComputer(request) ? next() : refused(),
);

const onlyThisTool = createCsrfMiddleware({
  filter: (context) => context.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  requestMiddleware: [onlyThisComputer, onlyThisTool],
}));
