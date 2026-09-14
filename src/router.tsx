import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { setupFactCache } from "./lib/query-persist";

/**
 * Factory that builds the app's TanStack Router instance. Called once per
 * request on the server and once on the client. Creates a fresh
 * `QueryClient` (shared with routes via router context, see `__root.tsx`),
 * wires up the persisted fact-cache layer (`setupFactCache`), and configures
 * scroll restoration + eager (non-stale) preloading.
 */
export const getRouter = () => {
  const queryClient = new QueryClient();
  setupFactCache(queryClient);


  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
