/**
 * What the build knows about where it came from.
 *
 * Substituted into the bundle by Vite, from git, at the moment it is built —
 * so a deployed page can say which commit it is without being asked. Fields
 * are null where git had no answer, which is the normal state for a build made
 * outside a checkout.
 */
export interface BuildInfo {
  commit: string | null;
  branch: string | null;
  message: string | null;
  /** ISO 8601 in UTC, from the moment the bundle was built. */
  built: string;
  /** Whether anything was uncommitted when the bundle was built. */
  dirty: boolean;
}

export const BUILD_INFO: BuildInfo = __BUILD_INFO__;
