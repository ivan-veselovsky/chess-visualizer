import type { HistoryEntry } from "../chess/history";
import { parsePgn } from "../chess/pgn";
import { parseFen } from "../chess/position";

/** The query parameters a link can carry. */
export const POSITION_PARAM = "position";
export const GAME_PARAM = "game";

/** What a link asked the page to open. */
export interface Opening {
  /** A whole line, newest first, or null when only a position was named. */
  entries: HistoryEntry[] | null;
  fen: string;
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
      // The list runs newest first, so the game's start is its last entry.
      return { entries, fen: entries[entries.length - 1].fen };
    }
  }

  const position = asked.get(POSITION_PARAM);
  if (position !== null) {
    const wanted = position.trim();
    if (parseFen(wanted).position !== null) {
      return { entries: null, fen: wanted };
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

export const gameLink = (pgn: string): string => link(GAME_PARAM, pgn);
