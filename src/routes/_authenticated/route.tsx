import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

/**
 * Layout/pathless route guarding every route nested under `_authenticated`
 * (currently `/profile` and `/saved`). Does not correspond to a URL segment
 * itself. `ssr: false` means the auth check and children only run/render on
 * the client. `beforeLoad` calls `supabase.auth.getUser()`; if there's no
 * signed-in user it redirects to `/auth` before any child route loads,
 * otherwise it exposes `user` on the route context for children to use.
 */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
