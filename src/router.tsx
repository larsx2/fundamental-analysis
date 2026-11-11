import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  // Keeps what screens have already fetched, so moving between them does
  // not ask the server for the same data again.
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
  });

  // Data fetched while the server draws the page is handed to the browser,
  // so the page does not fetch it a second time.
  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}
