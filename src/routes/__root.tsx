import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

/**
 * Rendered by the router for any URL that doesn't match a route (TanStack
 * Router's global 404 fallback). Purely presentational — no data loading.
 */
function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Root-level error boundary. Rendered when a route's loader/component throws.
 * Reports the error to the Lovable error-tracking pipeline and offers the
 * user a way to retry (re-run loaders) or bail out to the home page.
 */
function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Root route for the whole app. Not tied to a URL segment itself — every
 * other route renders inside it via <Outlet />. Declares the shared
 * `queryClient` context (created in src/router.tsx) that all routes can use
 * for loader data fetching, plus the default <head> tags/meta and the
 * document shell (html/head/body) used for SSR.
 */
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#12100e" },
      { title: "The Daily How" },
      {
        name: "description",
        content: "One short explainer every day: how things work and what things mean.",
      },
      { property: "og:title", content: "The Daily How" },
      {
        property: "og:description",
        content: "One short explainer every day: how things work and what things mean.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Daily How" },
      { name: "application-name", content: "The Daily How" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Manrope:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});


/**
 * Outermost HTML document shell used during SSR (and hydration). Wraps the
 * rendered route tree with <html>/<head>/<body>, injecting collected <head>
 * tags via <HeadContent /> and the client-side hydration script via <Scripts />.
 */
function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

/**
 * Root component rendered inside the shell. Sets up the React Query
 * provider for the whole app and listens to Supabase auth state changes:
 * on sign-in/sign-out/user-update it invalidates the router (so route
 * `beforeLoad`/loaders re-run) and clears cached user-specific queries
 * (profile, saved facts, quiz stats, streak calendar, per-fact saved state).
 * Shared content queries (today's fact, archive) are left untouched since
 * they don't depend on the signed-in user.
 */
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") {
        // Only invalidate user-specific queries, not facts/archive (which are shared)
        queryClient.invalidateQueries({ queryKey: ["profile"] });
        queryClient.invalidateQueries({ queryKey: ["saved-facts"] });
        queryClient.invalidateQueries({ queryKey: ["quiz-stats"] });
        queryClient.invalidateQueries({ queryKey: ["streak-calendar"] });
        queryClient.invalidateQueries({ queryKey: ["fact-saved"] });
      }
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}

