import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useRef } from "react";
import { AppShell } from "@/components/AppShell";
import { AppHeader } from "@/components/AppHeader";
import { getArchive } from "@/lib/facts.functions";
import { FACT_GC_TIME, msUntilUtcMidnight } from "@/lib/cache-time";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Query definition for the full archive of past explainers. Cached until
 * the next UTC midnight, since the archive only grows once per day.
 */
const archiveQuery = queryOptions({
  queryKey: ["archive"],
  queryFn: () => getArchive(),
  // Served straight from the device cache until a new day starts.
  staleTime: msUntilUtcMidnight(),
  gcTime: FACT_GC_TIME,
});


/**
 * Route: `/archive` — lists every past explainer.
 * Shows a filterable (by category) list of previously featured facts plus
 * a live countdown to the next explainer at UTC midnight.
 * Data: loads `archiveQuery` (all archived facts) via the loader. Public
 * route, no authentication required.
 */
export const Route = createFileRoute("/archive")({
  loader: ({ context }) => context.queryClient.ensureQueryData(archiveQuery),
  head: () => ({
    meta: [
      { title: "Archive — every past explainer from The Daily How" },
      {
        name: "description",
        content:
          "Catch up on every explainer that has been featured, from how a door key works to what a credit score means.",
      },
      { property: "og:title", content: "Archive — every past explainer from The Daily How" },
      {
        property: "og:description",
        content: "Browse past days and read the explainers you missed.",
      },
    ],
  }),
  component: ArchivePage,
});

/** Live-updating countdown to the next UTC midnight, when a new fact unlocks. */
function CountdownNote() {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const next = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate() + 1,
        0,
        0,
        0,
        0,
      );
      const msLeft = Math.max(0, next - now.getTime());

      // Convert milliseconds to hours, minutes, seconds
      const totalSeconds = Math.floor(msLeft / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      // Format as "12h 34m 56s"
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mb-5 rounded-2xl border border-dashed border-border p-5 text-center">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Tomorrow</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Sealed until midnight UTC. A new topic, a different category.
      </p>
      {timeLeft && (
        <p className="mt-3 text-xs font-semibold text-primary">
          Time left: {timeLeft}
        </p>
      )}
    </div>
  );
}

interface CategoryFilterProps {
  categories: string[];
  selectedCategories: string[];
  onCategoryChange: (category: string) => void;
  onClearFilters: () => void;
}

/** Horizontally-scrollable pill list for filtering the archive by category. */
function CategoryFilter({
  categories,
  selectedCategories,
  onCategoryChange,
  onClearFilters,
}: CategoryFilterProps) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (containerRef.current) {
      const scrollAmount = 200;
      const newPosition =
        direction === "left"
          ? Math.max(0, scrollPosition - scrollAmount)
          : scrollPosition + scrollAmount;
      containerRef.current.scrollLeft = newPosition;
      setScrollPosition(newPosition);
    }
  };

  const showLeftArrow = scrollPosition > 0;
  const showRightArrow = containerRef.current && scrollPosition < containerRef.current.scrollWidth - containerRef.current.clientWidth;

  return (
    <div className="mb-6">
      {selectedCategories.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {selectedCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat)}
              className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/25"
            >
              {cat}
              <X className="h-3 w-3" />
            </button>
          ))}
          <button
            onClick={onClearFilters}
            className="text-xs text-muted-foreground underline hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      <div className="relative">
        {showLeftArrow && (
          <button
            onClick={() => scroll("left")}
            className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background p-1.5 shadow-md transition-colors hover:bg-secondary"
          >
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
        )}

        <div
          ref={containerRef}
          className="flex gap-2 overflow-x-auto scroll-smooth"
          style={{
            scrollBehavior: "smooth",
            msOverflowStyle: "none",
            scrollbarWidth: "none",
          }}
        >
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                selectedCategories.includes(category)
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-foreground hover:border-primary/50"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {showRightArrow && (
          <button
            onClick={() => scroll("right")}
            className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-background p-1.5 shadow-md transition-colors hover:bg-secondary"
          >
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

/** Archive page component: category filter + list of archived fact links. */
function ArchivePage() {
  const { data = [] } = useQuery(archiveQuery);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Get unique categories from data
  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(data.map((entry) => entry.category))];
    return uniqueCategories.sort();
  }, [data]);

  // Filter data based on selected categories
  const filteredData = useMemo(() => {
    if (selectedCategories.length === 0) {
      return data;
    }
    return data.filter((entry) => selectedCategories.includes(entry.category));
  }, [data, selectedCategories]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category]
    );
  };

  const handleClearFilters = () => {
    setSelectedCategories([]);
  };

  return (
    <AppShell>
      <AppHeader eyebrow="Archive" />
      <CountdownNote />

      {categories.length > 0 && (
        <CategoryFilter
          categories={categories}
          selectedCategories={selectedCategories}
          onCategoryChange={handleCategoryChange}
          onClearFilters={handleClearFilters}
        />
      )}

      {filteredData.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {selectedCategories.length > 0
            ? "No facts found in selected categories."
            : "Nothing archived yet — come back tomorrow."}
        </p>
      ) : (
        <ul className="space-y-3">
          {filteredData.map((entry) => (
            <li key={entry.pick_date}>
              <Link
                to="/fact/$slug"
                params={{ slug: entry.slug }}
                className="block rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  <span>{entry.category}</span>
                  <time dateTime={entry.pick_date}>
                    {new Date(`${entry.pick_date}T00:00:00Z`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      timeZone: "UTC",
                    })}
                  </time>
                </div>
                <h2 className="mt-2 text-display text-lg leading-snug text-foreground">
                  {entry.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{entry.hook}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
