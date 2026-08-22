import { BUILD_INFO } from "./buildInfo";

/**
 * Which build this is, for a page that has been deployed somewhere and is now
 * being asked what it is.
 *
 * Read-only and quiet: it settles a question rather than offering anything, so
 * it sits below the buttons in the panel's own muted colour. Nothing shows at
 * all where git had no answer — an empty "About" would be worse than none.
 *
 * The timestamp is read straight out of the stamped string rather than through
 * a Date, which would move it into whichever zone the page is being read in and
 * so give one build as many times as it has readers. It is UTC, and says so.
 */
export default function AboutBuild() {
  const { commit, branch, message, built, dirty } = BUILD_INFO;
  if (commit === null) {
    return null;
  }

  const on = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/.exec(built);
  return (
    <p className="about-build" aria-label="About this build">
      Built{on !== null && <> on {`${on[1]} ${on[2]} UTC`}</>} from revision{" "}
      <span className="about-commit">
        {commit}
        {dirty ? "+" : ""}
      </span>
      {branch !== null && <> on branch "{branch}"</>}
      {message !== null && <>: "{message}"</>}
    </p>
  );
}
