import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, DEFAULT_POSITION, type Square } from "chess.js";
import {
  canGoNext,
  canGoPrevious,
  currentPosition,
  goFirst,
  goLast,
  goNext,
  goToPosition,
  historyFromLine,
  indexOfPosition,
  goPrevious,
  pushPosition,
  sameLine,
  startHistory,
  type PositionHistory,
} from "../chess/history";
import { applyMove } from "../chess/moves";
import { parsePgn, toPgn } from "../chess/pgn";
import { GAME_LIBRARY, type LibraryGame } from "../chess/gameLibrary";
import {
  stashGame,
  stashedGame,
  type GameStash,
} from "../chess/stash";
import { parseFen } from "../chess/position";
import CopyButton from "./CopyButton";
import { gameLink, openingFromLocation, positionLink } from "./sharing";
import Board from "../visualization/Board";
import type { LastMove } from "../visualization/layers/HighlightLayer";
import GameLibrary from "./GameLibrary";
import FenField from "./FenField";
import GearIcon from "./GearIcon";
import GitHubIcon from "./GitHubIcon";
import SponsorIcon from "./SponsorIcon";
import StepIcon from "./StepIcon";
import OptionsPanel from "./OptionsPanel";
import PgnDialog from "./PgnDialog";
import PgnExportDialog from "./PgnExportDialog";
import PgnHelp from "./PgnHelp";
import StashDialog from "./StashDialog";
import StashedGames from "./StashedGames";
import ToggleField from "./ToggleField";
import type { Options } from "./options";
import { DEFAULT_OPTIONS } from "./presets";

export default function App() {
  const [options, setOptions] = useState<Options>(DEFAULT_OPTIONS);
  const [optionsOpen, setOptionsOpen] = useState(false);
  /*
    What the page opens on. A link may name a position; read once, at the first
    render, so that stepping away from it afterwards is not undone by a later
    render reading the address bar again.
  */
  const [opening] = useState(openingFromLocation);
  const [fen, setFen] = useState(opening?.fen ?? DEFAULT_POSITION);
  const [history, setHistory] = useState<PositionHistory>(() =>
    opening?.entries == null
      ? startHistory(opening?.fen ?? DEFAULT_POSITION)
      : historyFromLine(opening.entries)
  );
  const [pgnOpen, setPgnOpen] = useState(false);
  // Which library game the board is on, so the list can keep naming it, and why
  // one would not load, if ever one does not.
  const [libraryGame, setLibraryGame] = useState<string | null>(null);
  const [libraryGameError, setLibraryGameError] = useState<string | null>(null);
  const [pgnExportOpen, setPgnExportOpen] = useState(false);
  /*
    Games put aside for the session, and the name the one on the board goes by.
    The name is what "Stash it" writes back over; until the game has been given
    one there is nothing to write to, which is what disables that button.
  */
  const [stash, setStash] = useState<GameStash>([]);
  const [stashName, setStashName] = useState<string | null>(null);
  const [stashDialogOpen, setStashDialogOpen] = useState(false);

  /**
   * Replaces the history with a whole game, positioned at its start so it can
   * be stepped through from the beginning. Returns why the text was rejected,
   * for the dialog to show without closing.
   */
  function loadPgn(pgn: string): string | null {
    const { entries, error } = parsePgn(pgn);
    if (entries === null) {
      return error;
    }
    const loaded = historyFromLine(entries);
    setHistory(loaded);
    setFen(currentPosition(loaded));
    setLibraryGame(null);
    setStashName(null);
    return null;
  }

  /**
   * A game chosen from the list: read in exactly as a pasted one is, but the
   * list goes on naming it afterwards.
   */
  function loadLibraryGame(game: LibraryGame) {
    const error = loadPgn(game.pgn);
    setLibraryGameError(error);
    if (error === null) {
      setLibraryGame(game.id);
    }
  }

  /**
   * The file a library game came from, while the board still holds that game
   * unchanged.
   *
   * Worth going back for rather than writing the game out again: the file
   * carries the tags the game is actually known by — who played it, where and
   * when — and replaying the moves through chess.js would put a roster of
   * question marks in their place. As soon as a move of one's own is played
   * the line stops being that game, and writing it out is the only honest
   * thing left to do.
   */
  function originalPgn(): string | null {
    if (libraryGame === null) {
      return null;
    }
    const game = GAME_LIBRARY.find((candidate) => candidate.id === libraryGame);
    if (game === undefined) {
      return null;
    }
    const { entries } = parsePgn(game.pgn);
    return entries !== null && sameLine(entries, history.entries)
      ? game.pgn
      : null;
  }

  /** The game as it would be written out, for exporting or for sharing. */
  function sharablePgn(): string | null {
    return originalPgn() ?? toPgn(history, stashName);
  }

  /** Puts the game aside under the name it already goes by. */
  function stashHere(name: string) {
    setStash(stashGame(stash, name, history));
    setStashName(name);
  }

  /**
   * A game taken back out of the stash, restored as it was left — the same
   * line, at the same position in it — and still going by the same name.
   */
  function loadStashedGame(name: string) {
    const game = stashedGame(stash, name);
    if (game === undefined) {
      return;
    }
    setHistory(game.history);
    setFen(currentPosition(game.history));
    setStashName(name);
    setLibraryGame(null);
    setLibraryGameError(null);
  }

  /**
   * A position arrived at by playing: recorded after the current one, with
   * anything that had followed dropped.
   */
  function playPosition(fen: string, move: string) {
    setFen(fen);
    setHistory(pushPosition(history, fen, move));
  }

  /**
   * A position set outright — typed in, chosen from the examples, or reset.
   * That starts a fresh line rather than continuing one: there is no move
   * connecting it to what came before, so nothing to step back through.
   */
  function setPosition(next: string) {
    setFen(next);
    setHistory(startHistory(next));
    setLibraryGame(null);
    setLibraryGameError(null);
    setStashName(null);
  }

  /**
   * What the FEN field reports, which is either of two things.
   *
   * A position already in the list is one of its own suggestions being picked,
   * so the pointer moves to it and the list survives. Anything else is a
   * position typed or pasted in, which starts a fresh line. Deciding by value
   * rather than by how the field was operated also means pasting a FEN you had
   * reached earlier returns you to it rather than discarding what followed.
   */
  function enterPosition(next: string) {
    const at = indexOfPosition(history, next);
    if (at < 0) {
      setPosition(next);
      return;
    }
    setHistory(goToPosition(history, at));
    setFen(next);
  }

  /**
   * Walks the list without changing it — what the four step buttons call.
   * Whether each is available is `canGoPrevious` / `canGoNext`: reaching an end
   * of the list needs something in that direction, exactly as a step does.
   */
  function stepHistory(direction: "first" | "previous" | "next" | "last") {
    const walk = { first: goFirst, previous: goPrevious, next: goNext, last: goLast };
    const moved = walk[direction](history);
    setHistory(moved);
    setFen(currentPosition(moved));
  }

  const { position, error } = useMemo(() => parseFen(fen), [fen]);

  /*
    Which two squares the move that reached this position used.

    Replayed rather than recorded: the list keeps a move's notation and the
    position it led to, and every way a line can arrive — played, pasted,
    stashed, read out of the library — already agrees on those two. Asking
    chess.js to play the move again on the position before it is the one step
    that turns notation back into squares, and it costs nothing next to
    everything else drawn on a change of position.
  */
  const lastMove = useMemo<LastMove | null>(() => {
    const entry = history.entries[history.current];
    const before = history.entries[history.current + 1];
    if (entry === undefined || entry.move === null || before === undefined) {
      return null;
    }
    try {
      const board = new Chess(before.fen);
      const { from, to } = board.move(entry.move);
      return { from, to };
    } catch {
      return null;
    }
  }, [history]);

  // On the document root rather than a wrapper: the frame colour has to reach
  // the whole viewport, and this component only owns part of it.
  useEffect(() => {
    document.documentElement.dataset.theme = options.theme;
    // Read only from inside the dark theme's own block, so publishing it under
    // the light theme is inert rather than something to guard against.
    document.documentElement.style.setProperty(
      "--dark-theme-fg",
      options.darkThemeTextColor
    );
  }, [options.theme, options.darkThemeTextColor]);

  // A FEN is unparseable for most of the time it takes to type one, so the
  // board keeps showing the last position that did parse rather than blanking.
  const lastValid = useRef(position);
  if (position !== null) {
    lastValid.current = position;
  }
  const shown = position ?? lastValid.current;

  /** Moves come back from the board as squares; the position that follows is
   *  a new FEN, so editing by hand and playing by hand feed the same state. */
  function handleMove(from: Square, to: Square) {
    if (shown === null) {
      return;
    }
    const next = applyMove(shown, from, to);
    if (next !== null) {
      playPosition(next.fen, next.san);
    }
  }

  return (
    <main className="app">
      <header className="app-header">
        <h1>Chess Visualizer</h1>
        {/* New tabs throughout: the stash and the game on the board are held
            in memory alone, and navigating away would take them with it. */}
        <a
          className="header-link sponsor-link"
          href="https://github.com/sponsors/ivan-veselovsky"
          target="_blank"
          rel="noreferrer"
        >
          <SponsorIcon />
          Sponsor this project
        </a>
        <a
          className="header-link source-link"
          href="https://github.com/ivan-veselovsky/chess-visualizer/"
          target="_blank"
          rel="noreferrer"
        >
          <GitHubIcon />
          Source on GitHub
        </a>
        <button
          type="button"
          className="gear-button"
          aria-label="Options"
          aria-expanded={optionsOpen}
          title="Options"
          onClick={() => setOptionsOpen((open) => !open)}
        >
          <GearIcon />
        </button>
      </header>

      <div className="app-body">
        {/* Left: the board alone, as tall as the window allows. */}
        <section className="board-pane">
          {shown !== null && (
            <Board
              position={shown}
              colors={options.boardColors}
              pieceTint={options.pieceTint}
              attacks={options.attacks}
              onMove={handleMove}
              showGrid={options.showGrid}
              lastMove={lastMove}
              lastMoveColor={options.lastMoveColor}
              lastMoveOpacity={options.lastMoveOpacity}
              orientation={options.orientation}
            />
          )}
        </section>

        {/* Right: everything else, stacked, in the order it is reached for. */}
        <div className="side-column">
          <div className="board-controls">
            <button
              type="button"
              className="reset-button"
              onClick={() => setPosition(DEFAULT_POSITION)}
            >
              Reset to initial position
            </button>
            <div className="step-buttons">
              <button
                type="button"
                className="reset-button step-button step-button-end"
                title="First position"
                aria-label="First position"
                disabled={!canGoPrevious(history)}
                onClick={() => stepHistory("first")}
              >
                <StepIcon direction="first" />
              </button>
              <button
                type="button"
                className="reset-button step-button"
                title="Previous position"
                aria-label="Previous position"
                disabled={!canGoPrevious(history)}
                onClick={() => stepHistory("previous")}
              >
                <StepIcon direction="previous" />
              </button>
              <button
                type="button"
                className="reset-button step-button"
                title="Next position"
                aria-label="Next position"
                disabled={!canGoNext(history)}
                onClick={() => stepHistory("next")}
              >
                <StepIcon direction="next" />
              </button>
              <button
                type="button"
                className="reset-button step-button step-button-end"
                title="Last position"
                aria-label="Last position"
                disabled={!canGoNext(history)}
                onClick={() => stepHistory("last")}
              >
                <StepIcon direction="last" />
              </button>
            </div>
            <ToggleField
              id="flip-board"
              label="Black at bottom"
              checked={options.orientation === "black"}
              onChange={(flipped) =>
                setOptions({
                  ...options,
                  orientation: flipped ? "black" : "white",
                })
              }
            />
          </div>

          {/* Second row: what a whole game can be done with. */}
          <div className="board-controls">
            <span className="field-with-help">
              <button
                type="button"
                className="reset-button"
                aria-describedby="import-pgn-help"
                onClick={() => setPgnOpen(true)}
              >
                Import game (PGN)
              </button>
              <PgnHelp id="import-pgn-help" />
            </span>
            <span className="field-with-help">
              <button
                type="button"
                className="reset-button"
                aria-describedby="export-pgn-help"
                onClick={() => setPgnExportOpen(true)}
              >
                Export game (PGN)
              </button>
              <PgnHelp id="export-pgn-help" fromEnd />
            </span>
            <CopyButton
              label="Share game"
              title="Copy a link that opens this game at its first position"
              text={() => {
                const pgn = sharablePgn();
                return pgn === null ? null : gameLink(pgn);
              }}
            />
            {/* Put aside at the right, away from the two that move PGN about. */}
            <div className="stash-actions">
              <button
                type="button"
                className="reset-button"
                disabled={stashName === null}
                title={
                  stashName === null
                    ? "Stash game as \u2026 first, to give the game a name"
                    : `Put this game back under \u201c${stashName}\u201d`
                }
                onClick={() => {
                  if (stashName !== null) {
                    stashHere(stashName);
                  }
                }}
              >
                Stash game
              </button>
              <button
                type="button"
                className="reset-button"
                title="Put this game aside under a name"
                onClick={() => setStashDialogOpen(true)}
              >
                Stash game as {"\u2026"}
              </button>
            </div>
          </div>

          <FenField
            value={fen}
            error={error}
            onChange={enterPosition}
            entries={history.entries}
            current={history.current}
            shareLink={positionLink}
            onSelectPosition={(index) => {
              const moved = goToPosition(history, index);
              setHistory(moved);
              setFen(currentPosition(moved));
            }}
          />

          <div className="library-row">
            <GameLibrary
              value={libraryGame}
              error={libraryGameError}
              onSelect={loadLibraryGame}
            />
            <StashedGames
              stash={stash}
              value={stashName}
              onSelect={loadStashedGame}
            />
          </div>

          {/*
            Out here rather than in the options panel: turning a side's marks
            off is part of reading the board, not of setting it up, and is
            reached for as often as the board is flipped.
          */}
          <div className="field-row field-row-halves">
            <ToggleField
              id="show-my-attacks"
              label="Show my attacks"
              checked={options.attacks.showAttacks.me}
              onChange={(me) =>
                setOptions({
                  ...options,
                  attacks: {
                    ...options.attacks,
                    showAttacks: { ...options.attacks.showAttacks, me },
                  },
                })
              }
            />
            <ToggleField
              id="show-opponent-attacks"
              label="Show opponent's attacks"
              checked={options.attacks.showAttacks.opponent}
              onChange={(opponent) =>
                setOptions({
                  ...options,
                  attacks: {
                    ...options.attacks,
                    showAttacks: { ...options.attacks.showAttacks, opponent },
                  },
                })
              }
            />
          </div>

          {optionsOpen && (
            <OptionsPanel
              options={options}
              defaults={DEFAULT_OPTIONS}
              onChange={setOptions}
            />
          )}
        </div>
      </div>

      <PgnDialog
        open={pgnOpen}
        onSubmit={loadPgn}
        onClose={() => setPgnOpen(false)}
      />

      <StashDialog
        open={stashDialogOpen}
        taken={stash.map((game) => game.name)}
        initialName={stashName}
        onSubmit={stashHere}
        onClose={() => setStashDialogOpen(false)}
      />

      <PgnExportDialog
        open={pgnExportOpen}
        // Only written when it is about to be shown.
        pgn={pgnExportOpen ? sharablePgn() : null}
        onClose={() => setPgnExportOpen(false)}
      />
    </main>
  );
}
