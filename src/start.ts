import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

/**
 * Global server request middleware: catches any otherwise-unhandled error
 * thrown while handling a request and returns the app's HTML error page
 * instead of letting it bubble up as a raw error. Errors that already carry
 * an HTTP `statusCode` (e.g. intentional redirects/not-found) are re-thrown
 * untouched so the framework can handle them normally.
 */
const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

/**
 * TanStack Start configuration entry point. Registers:
 * - `functionMiddleware: [attachSupabaseAuth]` — runs on every server
 *   function call, client-side, to attach the current Supabase session's
 *   bearer token to the request.
 * - `requestMiddleware: [errorMiddleware, csrfMiddleware]` — runs on every
 *   incoming server request: catches unhandled errors, then enforces CSRF
 *   protection specifically for server function calls (defining this file
 *   opts out of Start's automatic CSRF middleware, so it's re-added here
 *   explicitly).
 */
export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
