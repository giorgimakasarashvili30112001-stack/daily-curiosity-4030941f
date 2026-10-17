/**
 * useSession
 * ----------
 * File-level: Hook that exposes the current Supabase auth session/user and
 * keeps it live-updated by subscribing to Supabase auth state changes.
 */
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isHydrated } from "@/lib/hydrated";

/** Last known session, kept so pages that mount again do not flash a "checking" state. */
let known: { session: Session | null } | null = null;

/**
 * useSession
 * Fetches the current Supabase session on mount and subscribes to auth
 * state changes (sign in/out, token refresh) so consumers always see the
 * latest session without polling.
 *
 * State:
 * - session: the current Supabase Session object, or null if signed out.
 * - loading: true until the initial session lookup resolves.
 *
 * Returns: { session, user, loading } where `user` is a convenience
 * accessor for `session?.user` (or null).
 *
 * No props; no UI is rendered — this is a data hook, not a component.
 */
export function useSession() {
  // Only trust the remembered session after hydration, so the first render matches the server.
  const remembered = isHydrated() ? known : null;
  const [session, setSession] = useState<Session | null>(remembered?.session ?? null);
  const [loading, setLoading] = useState(!remembered);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      known = { session: data.session };
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      known = { session: next };
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}
