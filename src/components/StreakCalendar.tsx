/**
 * StreakCalendar
 * --------------
 * File-level: Renders a month calendar (on the Profile page) showing which
 * days the user answered the daily quiz correctly ("marked" streak days)
 * and which days they merely saved a fact, with month navigation and
 * visual "streak bar" styling that highlights consecutive/full-week runs.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getStreakCalendar } from "@/lib/quiz.functions";
import { StreakIcon } from "./StreakIcon";

// Weekday header labels, Monday-first to match the grid layout below.
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/** Formats a Date as a "YYYY-MM" key used for query caching and lookups. */
function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Returns today's date as an ISO "YYYY-MM-DD" string for highlighting "today". */
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// A contiguous run of calendar-grid cell indices that should be drawn as a
// connected streak "pill" (optionally a fully-completed week).
interface StreakSegment {
  startIndex: number;
  endIndex: number;
  isFullWeek?: boolean;
}

/**
 * Helper: computes the contiguous visual "streak segments" to render for a
 * month grid. A segment groups consecutive marked (correct-answer) and/or
 * saved days that fall within the same week row, so the UI can draw one
 * connected pill per run instead of separate dots. A segment is flagged
 * `isFullWeek` when all 7 days of that week were answered correctly
 * (saved-only days don't count toward a full week, only toward filling
 * visual gaps).
 */
function calculateStreakSegments(cells: (number | null)[], marked: Set<string>, saved: Set<string>, key: string): StreakSegment[] {
  const segments: StreakSegment[] = [];
  let currentStartIndex: number | null = null;

  for (let i = 0; i < cells.length; i++) {
    const day = cells[i];
    if (day === null) {
      if (currentStartIndex !== null) {
        segments.push({ startIndex: currentStartIndex, endIndex: i - 1 });
        currentStartIndex = null;
      }
      continue;
    }

    const dateKey = `${key}-${String(day).padStart(2, "0")}`;
    const isMarked = marked.has(dateKey);
    const isSaved = saved.has(dateKey);
    // For streak calculation: only marked counts
    // But visually: we include saved to fill gaps (so bar doesn't break)
    const isVisualPart = isMarked || isSaved;
    const weekIndex = Math.floor(i / 7);


    // Check if we need to end the current streak (week boundary)
    if (currentStartIndex !== null) {
      const currentWeekIndex = Math.floor(currentStartIndex / 7);
      if (weekIndex !== currentWeekIndex) {
        segments.push({ startIndex: currentStartIndex, endIndex: i - 1 });
        currentStartIndex = null;
      }
    }

    if (isVisualPart) {
      if (currentStartIndex === null) {
        currentStartIndex = i;
      }
    } else {
      if (currentStartIndex !== null) {
        segments.push({ startIndex: currentStartIndex, endIndex: i - 1 });
        currentStartIndex = null;
      }
    }
  }

  // Handle remaining segment
  if (currentStartIndex !== null) {
    segments.push({ startIndex: currentStartIndex, endIndex: cells.length - 1 });
  }

  // Check which segments are full weeks and mark them
  // A full week counts ONLY marked days (not saved), but visually includes saved days
  return segments.map((segment) => {
    const weekStartIndex = (Math.floor(segment.startIndex / 7)) * 7;
    const weekEndIndex = weekStartIndex + 6;
    
    // Count only marked days in this week to determine if it's a "full week"
    let markedCount = 0;
    for (let i = weekStartIndex; i <= weekEndIndex; i++) {
      if (i < cells.length && cells[i] !== null) {
        const dateKey = `${key}-${String(cells[i]).padStart(2, "0")}`;
        if (marked.has(dateKey)) {
          markedCount++;
        }
      }
    }
    
    // Full week means all 7 correct days (not counting saved as full)
    const isFullWeek = markedCount === 7;
    return { ...segment, isFullWeek };
  });
}

/**
 * StreakCalendar
 * Renders a month-by-month calendar grid with Prev/Next controls (Next is
 * disabled once viewing the current month). Days the user answered
 * correctly are highlighted as connected "streak" pills (bold red
 * outline/glow when a full week was completed); days a fact was merely
 * saved are shown with a light blue background to visually bridge gaps.
 * Today's cell is ringed for emphasis.
 *
 * Props: none.
 *
 * State:
 * - view: the currently displayed month (a Date pinned to its 1st day, UTC).
 *
 * Data fetching:
 * - useQuery(["streak-calendar", monthKey]) calls the `getStreakCalendar`
 *   server function to fetch which dates in the viewed month were answered
 *   correctly (`correct`) or saved (`saved`).
 *
 * User interactions:
 * - Previous/Next month buttons change `view` (Next disabled on current month).
 */
export function StreakCalendar() {
  const fetchCalendar = useServerFn(getStreakCalendar);
  const now = new Date();
  const [view, setView] = useState(() => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const key = monthKey(view);
  const isCurrentMonth = key === monthKey(now);

  const { data: calendar } = useQuery({
    queryKey: ["streak-calendar", key],
    queryFn: () => fetchCalendar({ data: { month: key } }),
    staleTime: 1000 * 60 * 60,
  });
  const marked = new Set(calendar?.correct ?? []);
  const savedDays = new Set(calendar?.saved ?? []);

  const year = view.getUTCFullYear();
  const month = view.getUTCMonth();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // Monday-first offset (getUTCDay: 0 = Sunday)
  const firstOffset = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;

  const monthLabel = view.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  const today = todayKey();

  const cells: (number | null)[] = [
    ...Array<null>(firstOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const streakSegments = calculateStreakSegments(cells, marked, savedDays, key);

  // Create a set of indices that are part of streak segments for quick lookup
  const streakIndices = new Set<number>();
  const fullWeekIndices = new Set<number>();
  streakSegments.forEach((segment) => {
    for (let i = segment.startIndex; i <= segment.endIndex; i++) {
      streakIndices.add(i);
      if (segment.isFullWeek) {
        fullWeekIndices.add(i);
      }
    }
  });

  return (
    <div className="mt-5 rounded-3xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => setView(new Date(Date.UTC(year, month - 1, 1)))}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-semibold text-foreground">{monthLabel}</p>
        <button
          type="button"
          aria-label="Next month"
          disabled={isCurrentMonth}
          onClick={() => setView(new Date(Date.UTC(year, month + 1, 1)))}
          className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`e${i}`} />;
          const dateKey = `${key}-${String(day).padStart(2, "0")}`;

          const isToday = dateKey === today;
          const isInStreak = streakIndices.has(i);
          const isFullWeek = fullWeekIndices.has(i);

          if (!isInStreak) {
            return (
              <span
                key={dateKey}
                className={[
                  "flex aspect-square items-center justify-center rounded-full text-xs",
                  "text-muted-foreground",
                  isToday ? "border border-primary text-foreground" : "",
                ].join(" ")}
              >
                {day}
              </span>
            );
          }

          // Find the segment this index belongs to
          const segment = streakSegments.find(
            (seg) => seg.startIndex <= i && i <= seg.endIndex
          );

          if (!segment) {
            return (
              <span key={dateKey} className="flex aspect-square items-center justify-center text-xs text-muted-foreground">
                {day}
              </span>
            );
          }

          const isStart = i === segment.startIndex;
          const isEnd = i === segment.endIndex;
          const isSingle = isStart && isEnd;

          const dayOfWeek = i % 7;


          const isFirstInWeek = dayOfWeek === 0; // Monday
          const isLastInWeek = dayOfWeek === 6;   // Sunday

          // Determine rounded corners based on position in segment
          let roundedClasses = "";
          if (isSingle) {
            roundedClasses = "rounded-full";
          } else if (isStart) {
            roundedClasses = "rounded-l-full";
          } else if (isEnd) {
            roundedClasses = "rounded-r-full";
          } else {
            roundedClasses = "rounded-none";
          }

          // Determine border placement
          let borderClasses = "";
          if (isFullWeek) {
            if (isSingle) {
              // Single day full week - all borders
              borderClasses = "border-2 border-red-500";
            } else if (isStart && isFirstInWeek) {
              // First day of week and start of streak - left, top, bottom
              borderClasses = "border-2 border-red-500 border-r-0";
            } else if (isEnd && isLastInWeek) {
              // Last day of week and end of streak - right, top, bottom
              borderClasses = "border-2 border-red-500 border-l-0";
            } else if (isFirstInWeek) {
              // First day of week, middle of streak - left, top, bottom
              borderClasses = "border-2 border-red-500 border-r-0";
            } else if (isLastInWeek) {
              // Last day of week, middle of streak - right, top, bottom
              borderClasses = "border-2 border-red-500 border-l-0";
            } else {
              // Middle days - only top and bottom
              borderClasses = "border-t-2 border-b-2 border-red-500";
            }
          }

          // Shadow: deep red, only horizontal glow (no Y offset)
          const shadowClasses = isFullWeek ? "shadow-[0_0_12px_rgba(239,68,68,0.6)]" : "";

          // Check if this day is saved
          const isSaved = savedDays.has(dateKey);

          // Use vivid colors for full weeks, muted for partial streaks
          // Saved days get light blue background but keep red border if full week
          let bgColor = "";
          let textColor = "";
          
          if (isSaved) {
            // Saved days: light blue background
            bgColor = "bg-sky-200 dark:bg-sky-400/30";
            textColor = "text-sky-900 dark:text-sky-100 font-semibold";
          } else {
            // Regular streak days
            bgColor = isFullWeek ? "bg-primary" : "bg-primary/15";
            textColor = isFullWeek ? "text-primary-foreground font-bold" : "text-primary font-semibold";
          }

          return (
            <span
              key={dateKey}
              className={[
                "flex aspect-square items-center justify-center text-xs transition-all",
                bgColor,
                textColor,
                roundedClasses,
                borderClasses,
                shadowClasses,
                isToday && isFullWeek ? "ring-2 ring-red-500" : isToday ? "ring-2 ring-primary" : "",
              ].join(" ")}
            >
              {day}
            </span>
          );
        })}
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <StreakIcon streak={10} className="h-3.5 w-3.5" />
        Marked days kept your streak alive
      </p>
    </div>
  );
}
