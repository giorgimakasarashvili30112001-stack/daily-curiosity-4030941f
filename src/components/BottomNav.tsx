/**
 * BottomNav
 * ---------
 * File-level: Persistent bottom tab bar for primary navigation between the
 * app's four main sections: Today, Archive, Saved, and Profile.
 */
import { Link } from "@tanstack/react-router";
import { Bookmark, CalendarDays, Sparkles, User } from "lucide-react";

// Static list of nav destinations shown as tabs, in display order.
const items = [
  { to: "/", label: "Today", icon: Sparkles },
  { to: "/archive", label: "Archive", icon: CalendarDays },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/profile", label: "Profile", icon: User },
] as const;

/**
 * BottomNav
 * Renders a fixed-to-bottom navigation bar with icon + label links for
 * Today, Archive, Saved and Profile. The active tab is highlighted via
 * router `activeProps`/`activeOptions` (Today only matches exactly on "/").
 *
 * No props, no local state; navigation state is derived from the router.
 */
export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to} className="flex-1">
            <Link
              to={to}
              className="flex flex-col items-center gap-1 py-3 text-[11px] font-medium text-muted-foreground transition-colors"
              activeOptions={{ exact: to === "/" }}
              activeProps={{ className: "text-primary" }}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
