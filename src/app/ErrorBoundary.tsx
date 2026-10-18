import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Whether an error is a part of the app that could not be fetched — the page
 * asking for a file a deploy has since replaced. Each browser says it in its
 * own words; the server answering with the page itself instead of the file
 * makes it a refused script rather than a missing one.
 */
export function isStaleCode(error: unknown): boolean {
  const said = error instanceof Error ? `${error.name} ${error.message}` : String(error);
  return /dynamically imported module|Importing a module script failed|module script|Failed to fetch|ChunkLoadError|MIME type/i.test(said);
}

interface ErrorBoundaryProps {
  /** What the part is called, for the message: "this tab", "the app". */
  what: string;
  children: ReactNode;
}

/**
 * What stands in for a part of the page that failed, rather than the page
 * going blank.
 *
 * React takes down everything above an error nobody catches, so a single panel
 * that would not load emptied the whole page, and all that was on the board
 * went with it. Caught here, only the part that failed is replaced, by a note
 * saying why and a button to reload — the rest of the page still answers, so
 * a game can be stashed or exported before reloading.
 *
 * The usual cause is a deploy: a page opened before it asks for a file that is
 * no longer there, and only a reload brings the page and its files back in
 * step. That one is said in so many words; anything else is said as itself.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, { error: unknown }> {
  state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`${this.props.what} failed`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error === null) {
      return this.props.children;
    }
    const stale = isStaleCode(error);
    return (
      <div className="error-boundary" role="alert">
        <p className="error-boundary-heading">
          {stale
            ? `The app has been updated since this page was opened, and ${this.props.what} cannot be loaded.`
            : `Something went wrong in ${this.props.what}.`}
        </p>
        <p className="error-boundary-note">
          {stale
            ? "Reloading the page brings it up to date. What is on the board is lost on reloading: stash or export it first, if it is worth keeping."
            : "Reloading the page should bring it back. What is on the board is lost on reloading: stash or export it first, if it is worth keeping."}
        </p>
        {!stale && <pre className="error-boundary-detail">{error instanceof Error ? error.message : String(error)}</pre>}
        <button type="button" className="reset-button" onClick={() => window.location.reload()}>
          Reload the page
        </button>
      </div>
    );
  }
}
