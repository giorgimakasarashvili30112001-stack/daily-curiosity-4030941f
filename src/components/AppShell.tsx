/**
 * AppShell
 * ---------
 * File-level: Top-level layout wrapper used by every page. Provides the
 * shared page background/grain texture, constrains content to a mobile-sized
 * column, and renders the persistent bottom navigation bar.
 */
import type { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

/**
 * AppShell
 * Renders the outer page shell: a full-height grained background, a
 * centered max-width column that hosts the page's `children`, and the
 * fixed BottomNav below the content.
 *
 * Props:
 * - children: the page content to render inside the shell.
 *
 * No local state or data fetching; purely a layout wrapper.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen page-grain pb-24">
      <div className="mx-auto max-w-md px-5 space-y-3">{children}</div>
      <BottomNav />
    </div>
  );
}
