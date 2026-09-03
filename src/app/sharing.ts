/*
  Written with their extensions, unlike the imports elsewhere — the same reason
  `settingsFile.ts` gives: this module is exercised by `tests/unit.mjs`, which
  node runs straight from the TypeScript with no bundler to guess at them, and
  these two are values rather than types, so they have to resolve at run time.
*/
import type { HistoryEntry } from "../chess/history";
import { parsePgn } from "../chess/pgn.ts";
import { parseFen } from "../chess/position.ts";

/** The query parameters a link can carry. */
export const POSITION_PARAM = "position";
export const GAME_PARAM = "game";
/** Whether the game a link carries should play itself once it is open. */
export const AUTOPLAY_PARAM = "autoplay";

/** What a link asked the page to open. */
export interface Opening {
  /** A whole line, newest first, or null when only a position was named. */
  entries: HistoryEntry[] | null;
  fen: string;
  /**
   * Whether the link asked for the game to play itself through.
   *
   * How fast it plays is not carried with it: that is the reader's own setting,
   * and a link that overrode it would be telling somebody else's browser how
   * fast they are allowed to read.
   */
  autoplay: boolean;
}

/**
 * What a link asks for, or null when it asks for nothing this page understands.
 *
 * A game wins over a position: it says more, and a link carrying both was
 * built by something other than this page.
 *
 * Anything unreadable is treated as absent rather than loaded and complained
 * about. The board would have nothing to show while the field sat there being
 * wrong, and a link is not something its reader can correct.
 */
export function openingFromUrl(search: string): Opening | null {
  const asked = new URLSearchParams(search);

  const pgn = asked.get(GAME_PARAM);
  if (pgn !== null) {
    const { entries } = parsePgn(pgn);
    if (entries !== null && entries.length > 0) {
      /*
        The position the board opens on, which must be the one the line is
        opened at or the two disagree: the history lands at the last move, so
        this is the last move's position. The list runs newest first, so that
        is its head.
      */
      return {
        entries,
        fen: entries[0].fen,
        autoplay: asked.get(AUTOPLAY_PARAM) === "1",
      };
    }
  }

  const position = asked.get(POSITION_PARAM);
  if (position !== null) {
    const wanted = position.trim();
    if (parseFen(wanted).position !== null) {
      // Nothing to play: a position is one board, and there is no line for it
      // to walk.
      return { entries: null, fen: wanted, autoplay: false };
    }
  }
  return null;
}

/** What the page opens on, where there is an address bar to read. */
export function openingFromLocation(): Opening | null {
  return typeof window === "undefined"
    ? null
    : openingFromUrl(window.location.search);
}

/**
 * This page's address carrying one parameter and nothing else — an old one
 * would otherwise ride along and, being read first, override what was shared.
 */
function link(parameter: string, value: string): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.searchParams.set(parameter, value);
  return url.toString();
}

/**
 * A link that opens this game, and — where asked — sets it playing.
 *
 * The flag is written only when it is on: a link is read by people as well as
 * by browsers, and one that says nothing is one thing less to wonder about.
 */
export function gameLink(pgn: string, autoplay = false): string {
  const url = new URL(link(GAME_PARAM, pgn));
  if (autoplay) {
    url.searchParams.set(AUTOPLAY_PARAM, "1");
  }
  return url.toString();
}
