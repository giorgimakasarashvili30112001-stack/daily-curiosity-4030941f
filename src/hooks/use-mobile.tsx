/**
 * useIsMobile
 * -----------
 * File-level: Hook that reports whether the viewport is currently narrower
 * than the mobile breakpoint, reacting live to window resizes.
 */
import * as React from "react";

// Viewport width (px) below which the layout is considered "mobile".
const MOBILE_BREAKPOINT = 768;

/**
 * useIsMobile
 * Tracks the browser viewport width via a matchMedia listener and reports
 * whether it is below MOBILE_BREAKPOINT (768px).
 *
 * State:
 * - isMobile: boolean | undefined internally (undefined before first
 *   measurement on mount); the hook coerces this to a boolean on return.
 *
 * Returns: boolean — true when the viewport is narrower than the
 * breakpoint. Not a UI component; used by other components to branch
 * rendering for mobile vs. desktop layouts.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
