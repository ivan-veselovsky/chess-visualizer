import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * What git says about the tree being built, read once when the config loads.
 *
 * Anything unavailable comes back as null rather than throwing: a build from a
 * downloaded archive, or anywhere without git on the path, has no repository to
 * ask and should still produce a working bundle.
 */
function gitInfo() {
  const ask = (...args: string[]): string | null => {
    try {
      return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      return null;
    }
  };
  return {
    commit: ask("rev-parse", "--short", "HEAD"),
    branch: ask("rev-parse", "--abbrev-ref", "HEAD"),
    message: ask("log", "-1", "--format=%s"),
    // When the bundle was made, not when the commit was: two deploys of one
    // commit are different builds, and it is the deploy being identified.
    //
    // UTC, and said so where it is shown. A build happens once and should read
    // the same to everyone; whose clock it was built by is nobody's business,
    // and a bare local time would be a different hour to every reader.
    built: new Date().toISOString(),
    // Anything uncommitted at build time, so a deployed bundle cannot claim to
    // be exactly the commit it names when it is not.
    dirty: ask("status", "--porcelain") !== "",
  };
}

export default defineConfig({
  plugins: [react()],
  // Baked in at build time; a running dev server keeps whatever it started with.
  define: {
    __BUILD_INFO__: JSON.stringify(gitInfo()),
  },
});
