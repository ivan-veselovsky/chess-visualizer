import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * The branch this build came off.
 *
 * `rev-parse --abbrev-ref HEAD` answers "HEAD" whenever the checkout is
 * detached, which is what every CI produces: they check out a commit, not a
 * branch, so git no longer knows which branch was meant. The build environment
 * does know, and says so in one variable or another, so it is asked first.
 *
 * Cloudflare appears twice because Pages and Workers Builds are two products
 * and name their variable differently — a build on the second was answering
 * with no branch at all while only the first was listed.
 *
 * Failing that, a local or remote branch pointing at this very commit is a good
 * guess — though a shallow CI clone often carries no such ref either, which is
 * why null is a possible answer. The line simply leaves the branch out then.
 */
function branchName(ask: (...args: string[]) => string | null): string | null {
  const announced =
    process.env.GITHUB_HEAD_REF || // a pull request's source branch
    process.env.GITHUB_REF_NAME || // GitHub Actions otherwise
    process.env.VERCEL_GIT_COMMIT_REF ||
    process.env.CF_PAGES_BRANCH || // Cloudflare Pages
    process.env.WORKERS_CI_BRANCH || // Cloudflare Workers Builds
    process.env.CI_COMMIT_REF_NAME || // GitLab
    process.env.CIRCLE_BRANCH ||
    process.env.BRANCH; // Netlify
  if (announced) {
    return announced;
  }

  const head = ask("rev-parse", "--abbrev-ref", "HEAD");
  if (head !== null && head !== "HEAD") {
    return head;
  }

  for (const refs of ["refs/heads", "refs/remotes"]) {
    const pointing = ask(
      "for-each-ref",
      "--points-at",
      "HEAD",
      "--format=%(refname:short)",
      refs
    );
    const named = (pointing ?? "")
      .split("\n")
      .map((name) => name.trim())
      .filter((name) => name !== "")
      // A remote's own HEAD lists as the bare remote name and names no branch.
      .filter((name) => refs === "refs/heads" || name.includes("/"));
    if (named.length > 0) {
      // "origin/main" is the same branch as "main" for the purpose of saying so.
      return named[0].replace(/^[^/]+\//, "");
    }
  }
  return null;
}

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
    branch: branchName(ask),
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
