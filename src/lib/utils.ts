/**
 * Small shared UI utility for composing Tailwind class names.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines conditional class name inputs (via `clsx`) and then resolves
 * any conflicting Tailwind utility classes (via `twMerge`), so later
 * classes win over earlier, conflicting ones.
 *
 * Params: `inputs` — any number of `clsx`-compatible class values
 * (strings, arrays, objects with boolean values, etc).
 * Returns: a single merged class name string.
 * Side effects: none.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
