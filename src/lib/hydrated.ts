/**
 * hydrated.ts
 * -----------
 * Tracks whether the app has finished its first client render (hydration).
 * The very first render must match the server HTML, so pages show a loading
 * state then. After that, pages that mount again (switching tabs) can render
 * cached data immediately instead of flashing the loading screen.
 */
let hydrated = false;

export function markHydrated(): void {
  hydrated = true;
}

export function isHydrated(): boolean {
  return hydrated;
}
