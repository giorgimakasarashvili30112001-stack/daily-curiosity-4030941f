/**
 * StreakIcon
 * ----------
 * File-level: Renders a visual badge representing the user's current streak
 * "level", using tiered SVG artwork with a flame icon as a graceful fallback
 * if the image fails to load.
 */
import { useState } from "react";
import { Flame } from "lucide-react";
import level1 from "../assets/streak/streak-level-1.svg";
import level2 from "../assets/streak/streak-level-2.svg";
import level3 from "../assets/streak/streak-level-3.svg";
import level4 from "../assets/streak/streak-level-4.svg";

// Streak level thresholds mapped to their artwork; the first entry whose
// `max` is >= the streak value is used (checked in ascending order).
const levels = [
  { max: 10, src: level1 },
  { max: 30, src: level2 },
  { max: 100, src: level3 },
  { max: Infinity, src: level4 },
];

/**
 * StreakIcon
 * Displays streak-level artwork (or a fallback flame icon) based on how
 * high the user's streak count is. Renders nothing when there is no streak.
 *
 * Props:
 * - streak: current streak count (number, null, or undefined); values <= 0
 *   render nothing.
 * - className: optional CSS classes applied to the icon/image.
 *
 * State:
 * - failed: tracks whether the level SVG failed to load, in which case a
 *   generic Flame icon is shown instead.
 */
export function StreakIcon({
  streak,
  className,
}: {
  streak: number | null | undefined;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  const value = streak ?? 0;
  if (value <= 0) return null;
  if (failed) {
    return <Flame className={className} aria-hidden="true" />;
  }

  const level = levels.find((l) => value <= l.max) ?? levels[levels.length - 1]!;

  return (
    <img
      src={level.src}
      alt=""
      className={className}
      aria-hidden="true"
      onError={() => setFailed(true)}
    />
  );
}
