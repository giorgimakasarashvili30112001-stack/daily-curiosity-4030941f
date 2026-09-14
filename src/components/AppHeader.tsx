/**
 * AppHeader
 * ---------
 * File-level: Page header shown at the top of each screen. Displays the app
 * logo/name (linking home), a small eyebrow label describing the current
 * page, and an optional streak badge.
 */
import { Link } from "@tanstack/react-router";
import { StreakIcon } from "./StreakIcon";

/**
 * AppHeader
 * Renders the app wordmark (links to "/"), an uppercase eyebrow label for
 * the current page, and — when the user has an active streak — a pill
 * badge with the StreakIcon and streak count.
 *
 * Props:
 * - eyebrow: small uppercase label describing the current page/section.
 * - streak: optional current streak count; badge is hidden when null/0.
 *
 * No local state or data fetching.
 */
export function AppHeader({
  eyebrow,
  streak,
}: {
  eyebrow: string;
  streak?: number | null;
}) {
  return (
    <header className="flex items-center justify-between pt-8 pb-6">
      <Link to="/" className="flex flex-col">
        <span className="text-display text-lg leading-none text-foreground">The Daily How</span>
        <span className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {eyebrow}
        </span>
      </Link>
      {typeof streak === "number" && streak > 0 ? (
        <span className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-semibold text-primary">
          <StreakIcon streak={streak} className="h-4 w-4" />
          {streak}
        </span>
      ) : null}
    </header>
  );
}
