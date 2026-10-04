/*
  Written with their extensions, unlike the imports elsewhere — the same reason
  `settingsFile.ts` gives: this module is exercised by `tests/unit.mjs`, which
  node runs straight from the TypeScript with no bundler to guess at them, and
  these two are values rather than types, so they have to resolve at run time.
*/
import type { HistoryEntry } from "../chess/history";
import { UNNAMED, parsePgn } from "../chess/pgn.ts";
import { parseFen } from "../chess/position.ts";

/** The query parameters a link can carry. */
export const POSITION_PARAM = "position";
export const GAME_PARAM = "game";
/** Whether the game a link carries should play itself once it is open. */
export const AUTOPLAY_PARAM = "autoplay";
/** Whether the board a link opens is turned round, Black at the bottom. */
export const BLACK_AT_BOTTOM_PARAM = "blackAtBottom";

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
  /**
   * Whether the link asked for the board turned round, Black at the bottom —
   * as the board was when it was shared, so a study of Black's play opens the
   * way it was being looked at.
   *
   * For this showing only. Which way round the reader keeps the board is
   * theirs, and remembered in their browser; a link followed once does not
   * change it for every page they open after.
   */
  blackAtBottom: boolean;
  /**
   * The game as the link's PGN tells it — who played it, how it ended, and the
   * text itself — so the page can open it the way a game read in from a file
   * opens: named over the board, and written back out whole while the line is
   * untouched.
   *
   * Null for a position, and for a game whose PGN names nobody and gives no
   * result. That is what this app writes for a line somebody pushed around a
   * board on their own, and opened as a game read in it would stand between
   * two players called White and Black — where the person who shared it saw no
   * names at all. Opened as a plain line it looks as it did to them.
   */
  game: SharedGame | null;
}

/** Who played a game, how it came out, and the PGN that said so. */
export interface SharedGame {
  players: { white: string; black: string };
  /** In PGN's own words, or null where it gives none. */
  result: string | null;
  /** The text the link carried, exactly. */
  pgn: string;
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
  const blackAtBottom = asked.get(BLACK_AT_BOTTOM_PARAM) === "true";

  const pgn = asked.get(GAME_PARAM);
  if (pgn !== null) {
    const { entries, players, result } = parsePgn(pgn);
    if (entries !== null && entries.length > 0) {
      const told =
        players.white !== UNNAMED.white || players.black !== UNNAMED.black || result !== null;
      /*
        The position the board opens on, which must be the one the line is
        opened at or the two disagree: the history lands at the last move, so
        this is the last move's position. The list runs newest first, so that
        is its head.
      */
      return {
        entries,
        fen: entries[0].fen,
        /* Written as "true" now, as the board's side is; links shared before
           said "1", and still play. */
        autoplay: asked.get(AUTOPLAY_PARAM) === "true" || asked.get(AUTOPLAY_PARAM) === "1",
        blackAtBottom,
        game: told ? { players, result, pgn } : null,
      };
    }
  }

  const position = asked.get(POSITION_PARAM);
  if (position !== null) {
    const wanted = position.trim();
    if (parseFen(wanted).position !== null) {
      // Nothing to play: a position is one board, and there is no line for it
      // to walk.
      return { entries: null, fen: wanted, autoplay: false, blackAtBottom, game: null };
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
 * A link that opens this game, and — where asked — sets it playing, and turns
 * the board round with Black at the bottom.
 *
 * The flags are written only when they are on: a link is read by people as
 * well as by browsers, and one that says nothing is one thing less to wonder
 * about.
 */
export function gameLink(pgn: string, autoplay = false, blackAtBottom = false): string {
  const url = new URL(link(GAME_PARAM, pgn));
  if (autoplay) {
    url.searchParams.set(AUTOPLAY_PARAM, "true");
  }
  if (blackAtBottom) {
    url.searchParams.set(BLACK_AT_BOTTOM_PARAM, "true");
  }
  return url.toString();
}
