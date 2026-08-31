import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, DEFAULT_POSITION, type Color, type Square } from "chess.js";
import {
  canGoNext,
  canGoPrevious,
  currentPosition,
  goFirst,
  goLast,
  goNext,
  goToPosition,
  historyFromLine,
  lineOf,
  indexOfPosition,
  goPrevious,
  pushPosition,
  sameLine,
  startHistory,
  type PositionHistory,
  type HistoryEntry,
} from "../chess/history";
import { capturesUpTo } from "../chess/captures";
import { applyMove } from "../chess/moves";
import {
  parsePgn,
  toPgn,
  type PgnEnding,
  type PgnPlayers,
} from "../chess/pgn";
import { GAME_LIBRARY, type LibraryGame } from "../chess/gameLibrary";
import {
  stashGame,
  stashedGame,
  type GameStash,
} from "../chess/stash";
import { parseFen } from "../chess/position";
import CopyButton from "./CopyButton";
import { gameLink, openingFromLocation } from "./sharing";
import Board from "../visualization/Board";
import type { LastMove } from "../visualization/layers/HighlightLayer";
import GameLibrary from "./GameLibrary";
import FenField from "./FenField";
import MovesSelect from "./MovesSelect";
import GearIcon from "./GearIcon";
import GitHubIcon from "./GitHubIcon";
import ShareIcon from "./ShareIcon";
import SponsorIcon from "./SponsorIcon";
import StepIcon from "./StepIcon";
import SettingsPanel from "./SettingsPanel";
import CapturedBar from "./CapturedBar";
import ConfirmDialog from "./ConfirmDialog";
import PgnDialog from "./PgnDialog";
import PgnExportDialog from "./PgnExportDialog";
import PgnHelp from "./PgnHelp";
import StashDialog from "./StashDialog";
import StashedGames from "./StashedGames";
import ToggleField from "./ToggleField";
import ChallengeDialog from "./friend/ChallengeDialog";
import InviteDialog from "./friend/InviteDialog";
import InvitePanel from "./friend/InvitePanel";
import JoinDialog from "./friend/JoinDialog";
import SavedGames from "./friend/SavedGames";
import { describeEnding } from "./friend/ending";
import { friendlyGameName } from "./friend/gameName";
import PlayerName from "./friend/PlayerName";
import { useFriendGame } from "./friend/useFriendGame";
import type { Heatmap, Settings } from "./settings";
import { DEFAULT_SETTINGS } from "./presets";

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  /** Asked when the heatmap goes on and the board is still a checkerboard. */
  const [askPlainBoard, setAskPlainBoard] = useState(false);

  function showHeatmap(patch: Partial<Heatmap>) {
    setSettings({
      ...settings,
      attacks: {
        ...settings.attacks,
        heatmap: { ...settings.attacks.heatmap, ...patch },
      },
    });
    /*
      The heatmap colours whole squares, and a checkerboard underneath gives
      every shade two readings. Worth offering to flatten — and worth asking
      rather than doing, since the board's colours are the reader's own setting.
      Either side going on raises the question; both being off again does not
      put the board back, the reader having answered it once.
    */
    if (
      (patch.showMine === true || patch.showOpponent === true) &&
      !settings.boardColors.useLightForDark &&
      settings.boardColors.darkSquare !== settings.boardColors.lightSquare
    ) {
      setAskPlainBoard(true);
    }
  }
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      : historyFromLine(opening.entries),
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
   * Replaces the history with a whole game, positioned at the last move it
   * reached. Returns why the text was rejected, for the dialog to show without
   * closing.
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
    /*
      A game with a friend has names, a place and a date; a line being studied
      has none of those, and PGN's own "?" is the truer answer for it.
    */
    const live =
      friend.phase.kind === "playing"
        ? {
            white: friend.phase.you === "w" ? friend.name : friend.phase.opponent,
            black: friend.phase.you === "b" ? friend.name : friend.phase.opponent,
            site: window.location.host,
          }
        : null;
    /*
      A game that has been put away still writes itself out in full, for as
      long as the line on the board is the one that was played — which is how
      a game from the library behaves, and for the same reason.
    */
    const remembered =
      played !== null && sameLine(played.entries, history.entries)
        ? played
        : null;
    const players = live ?? remembered?.players ?? null;
    /*
      How it ended, where the board cannot say. A resignation and an agreed
      draw both leave an ordinary position behind, and a PGN written from the
      moves alone would call the game unfinished.
    */
    const ending =
      friend.phase.kind === "playing" && friend.phase.over !== null
        ? {
            result: friend.phase.over.result,
            how: describeEnding(friend.phase.over.reason),
          }
        : (remembered?.ending ?? null);
    return originalPgn() ?? toPgn(history, stashName, players, ending);
  }

  /**
   * Puts a game on the board, built from where it starts and what has been
   * played — the moves being what the object keeps, so a line rebuilt from
   * them cannot disagree with it.
   */
  function putUp({
    initialFEN,
    moves,
  }: {
    initialFEN: string;
    moves: string[];
  }) {
    const board = new Chess(initialFEN);
    const entries: HistoryEntry[] = [{ fen: initialFEN, move: null }];
    for (const san of moves) {
      try {
        board.move(san);
      } catch {
        break;
      }
      entries.unshift({ fen: board.fen(), move: san });
    }
    setHistory({ entries, current: 0 });
    setFen(entries[0].fen);
    setLibraryGame(null);
    setStashName(null);
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

  /** Everything taken on the way to the position on the board. */
  const captures = useMemo(() => capturesUpTo(history), [history]);

  /** The friendly game: whether one is being offered, answered, or played. */
  const friend = useFriendGame({
    /*
      A move that has happened — mine or theirs, the object does not distinguish
      and neither does this. The position comes with it, so the two boards are
      the same board rather than two agreeing accounts of one.
    */
    onMoved: ({ san, fen: after }) => {
      setHistory((current) => pushPosition(current, after, san));
      setFen(after);
    },
    /*
      The whole line, on joining a game or coming back to one. Replayed here
      rather than sent as positions: the moves are what the object keeps, and
      a line rebuilt from them is a line that cannot disagree with it.
    */
    /*
      A move unmade. The line is kept newest-first, so the move just played is
      the entry at the head, and dropping it is the whole of it.
    */
    onTookBack: ({ fen: back }) => {
      setHistory((current) =>
        current.entries.length > 1
          ? { entries: current.entries.slice(1), current: 0 }
          : current
      );
      setFen(back);
    },
    onLine: ({ initialFEN, moves }) => {
      if (initialFEN === "") {
        return;
      }
      /*
        A game starting would replace whatever is on the board, and what is on
        it may have been an afternoon's work. So it waits: the board is left
        alone until the question has been answered, and the new game goes up
        whichever way it is answered.

        Unless the game starting *is* what is on the board — a game offered to
        be continued comes back as the line it was offered from. There is
        nothing to lose there and so nothing to ask about.
      */
      const here = lineOf(history);
      const same =
        here.initialFEN === initialFEN &&
        here.moves.join(" ") === moves.join(" ");
      if (!same && history.entries.length > 1 && stashName === null) {
        setWaitingToStart({ initialFEN, moves });
        return;
      }
      putUp({ initialFEN, moves });
    },
  });
  const [joining, setJoining] = useState(false);
  /**
   * A game that has begun but is not on the board yet, because what is on the
   * board has not been dealt with. Held until the question is answered, and
   * only then put up.
   */
  const [waitingToStart, setWaitingToStart] = useState<{
    initialFEN: string;
    moves: string[];
  } | null>(null);
  /**
   * A game with a friend that has finished, and what a PGN of it should say.
   *
   * Kept after the panel is put away, for the same reason a game from the
   * library is: the line on the board is still that game, and the things a
   * PGN wants to know about it — who played, where, how it ended — cannot be
   * worked out from the moves. Held only while the line is untouched; playing
   * on from it makes it something else, and then the answer is question marks.
   */
  const [played, setPlayed] = useState<{
    players: PgnPlayers;
    ending: PgnEnding;
    entries: HistoryEntry[];
  } | null>(null);

  /*
    Sitting down at the board: each player sees it from their own side.

    Once, when a game starts, rather than on every render — the toggle stays
    live, and someone who turns the board round to look from the other side
    should find it stays turned round.
  */
  /*
    While a game with somebody else is on, the ways of putting a different game
    on the board are closed. Disabled rather than hidden: the controls are
    still there to be seen, and hovering one says why it will not answer.
  */
  const inGame =
    friend.phase.kind === "playing" && friend.phase.over === null
      ? "Playing a game with a friend — finish it first"
      : null;

  /*
    Whether a takeback can be asked for, and when it cannot, why not.

    Four things have to hold, and the order they are asked in is the order they
    are worth saying: the game must be on, the move to unmake must be this
    player's own and still the last one, the board must be showing the game
    rather than a position back down the line, and there must be an allowance
    left. A game taken up from another one has a floor as well — the moves it
    was handed cannot be unmade by people who did not play them.
  */
  const takeback: { can: boolean; why: string } = (() => {
    const phase = friend.phase;
    if (phase.kind !== "playing" || phase.over !== null) {
      return { can: false, why: "" };
    }
    const left = phase.takebacksLeft?.[phase.you] ?? 0;
    // Whose move it is in the game, which is the head of the line — not the
    // position being looked at, which may be anywhere in it.
    const toMove = history.entries[0].fen.split(" ")[1];
    if (history.entries.length - 1 <= (phase.terms.priorMoves ?? 0)) {
      return {
        can: false,
        why: "The game was taken up from here; these moves came with it",
      };
    }
    if (toMove === phase.you) {
      return {
        can: false,
        why: "Your opponent has replied — only your own last move can be taken back",
      };
    }
    if (history.current !== 0) {
      return {
        can: false,
        why: "Go back to the latest position to take a move back",
      };
    }
    if (left <= 0) {
      return { can: false, why: "No takebacks left" };
    }
    return { can: true, why: `Take your last move back (${left} left)` };
  })();

  /*
    Which army is at which end of the board as it stands. The names follow the
    board rather than the players, so turning it round moves them with it.
  */
  const nearSide: Color = settings.orientation === "black" ? "b" : "w";
  const farSide: Color = nearSide === "w" ? "b" : "w";

  /*
    A finished game remembers itself, once, at the moment it finishes — while
    everything a PGN needs is still to hand.
  */
  const recorded = useRef<string | null>(null);
  useEffect(() => {
    const phase = friend.phase;
    if (
      phase.kind !== "playing" ||
      phase.over === null ||
      recorded.current === phase.gameId
    ) {
      return;
    }
    recorded.current = phase.gameId;
    setPlayed({
      players: {
        white: phase.you === "w" ? friend.name : phase.opponent,
        black: phase.you === "b" ? friend.name : phase.opponent,
        site: window.location.host,
      },
      ending: {
        result: phase.over.result,
        how: describeEnding(phase.over.reason),
      },
      entries: history.entries,
    });
  }, [friend.phase, friend.name, history.entries]);

  const seated = useRef<string | null>(null);
  useEffect(() => {
    const phase = friend.phase;
    if (phase.kind !== "playing" || seated.current === phase.gameId) {
      return;
    }
    seated.current = phase.gameId;
    setSettings((current) => ({
      ...current,
      orientation: phase.you === "b" ? "black" : "white",
    }));
  }, [friend.phase]);

  // On the document root rather than a wrapper: the frame colour has to reach
  // the whole viewport, and this component only owns part of it.
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    // Read only from inside the dark theme's own block, so publishing it under
    // the light theme is inert rather than something to guard against.
    document.documentElement.style.setProperty(
      "--dark-theme-fg",
      settings.darkThemeTextColor,
    );
  }, [settings.theme, settings.darkThemeTextColor]);

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
    if (next === null) {
      return;
    }
    /*
      In a game with somebody else the move is offered, not made. It reaches the
      board when the object says it happened — which is the same moment the
      opponent hears about it, and the only account either of them acts on.
    */
    if (friend.phase.kind === "playing") {
      // Only from the position the game is actually at: a move worked out from
      // an earlier one would be sent for a ply that has already been played.
      // And only while there is a line to send it down — a move handed to a
      // dead socket goes nowhere and is undone by the next thing the object
      // says, which looks to the player like the board eating their move.
      if (history.current !== 0 || !friend.link.mine) {
        return;
      }
      friend.move(history.entries.length - 1, next.san);
      return;
    }
    playPosition(next.fen, next.san);
  }

  return (
    <main
      className={
        friend.phase.kind === "playing" ? "app app-playing" : "app"
      }
    >
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
          aria-label="Settings"
          aria-expanded={settingsOpen}
          title="Settings"
          onClick={() => setSettingsOpen((open) => !open)}
        >
          <GearIcon />
        </button>
      </header>

      <div className="app-body">
        {/* Left: the board and the men taken off it, as tall as the window allows. */}
        <section className="board-pane">
          {shown !== null && (
            <div
              className={
                settings.showCapturedPiecesBar
                  ? "board-and-players"
                  : "board-and-players board-and-players-bare"
              }
            >
              {/* Whoever is at the far end of the board as it now stands. */}
              {friend.phase.kind === "playing" && (
                <PlayerName
                  name={
                    farSide === friend.phase.you
                      ? friend.name
                      : friend.phase.opponent
                  }
                  color={farSide}
                  mine={farSide === friend.phase.you}
                />
              )}
              <div className="board-with-captured">
                <Board
                position={shown}
                colors={settings.boardColors}
                pieceTint={settings.pieceTint}
                attacks={settings.attacks}
                onMove={handleMove}
                showGrid={settings.showGrid}
                gridColor={settings.gridColor}
                playable={
                  friend.phase.kind === "playing" ? friend.phase.you : null
                }
                // Stepping back through a game is reading it. Playing on from
                // an earlier position would be starting a different game, and
                // the one being played is not this browser's to fork.
                frozen={
                  friend.phase.kind === "playing" &&
                  (history.current !== 0 || !friend.link.mine)
                }
                lastMove={lastMove}
                lastMoveMark={settings.lastMove}
                orientation={settings.orientation}
              />
                {settings.showCapturedPiecesBar && (
                  <CapturedBar
                    captures={captures}
                    orientation={settings.orientation}
                    pieceTint={settings.pieceTint}
                    attacks={settings.attacks}
                  />
                )}
              </div>
              {/* And whoever is at this end. */}
              {friend.phase.kind === "playing" && (
                <PlayerName
                  name={
                    nearSide === friend.phase.you
                      ? friend.name
                      : friend.phase.opponent
                  }
                  color={nearSide}
                  mine={nearSide === friend.phase.you}
                />
              )}
            </div>
          )}
        </section>

        {/* Right: everything else, stacked, in the order it is reached for. */}
        <div className="side-column">
          {/* Offering a game, and taking one up. */}
          <div className="board-controls">
            <button
              type="button"
              className="reset-button"
              disabled={inGame !== null}
              title={inGame ?? undefined}
              onClick={friend.start}
            >
              Challenge a friend {"\u2026"}
            </button>
            <button
              type="button"
              className="reset-button"
              disabled={inGame !== null}
              title={inGame ?? "Enter the id somebody read out to you"}
              onClick={() => setJoining(true)}
            >
              Join a game {"\u2026"}
            </button>
          </div>

          {/*
            Older than the game it is in, and nothing it does will work until
            it is reloaded. Said where every other thing about the game is
            said, and shown whether or not a game is on — the page is what is
            out of date, not the game.
          */}
          {friend.outdated && (
            <aside className="invite-panel" role="alert">
              <p className="invite-heading">This page is out of date</p>
              <p className="invite-note">
                It was opened before the version now running, and the two no
                longer understand each other. Reloading picks up the new one.
              </p>
              <div className="pgn-dialog-actions">
                <button
                  type="button"
                  className="reset-button"
                  onClick={() => window.location.reload()}
                >
                  Reload
                </button>
              </div>
            </aside>
          )}

          {/* Only when this tab is at no game: a tab that is at one says so in
              its address, and the panel below is about that game. */}
          {friend.phase.kind === "idle" && (
            <SavedGames games={friend.games} onOpen={friend.rejoin} />
          )}

          <InvitePanel
            phase={friend.phase}
            link={friend.link}
            myName={friend.name}
            canTakeBack={takeback.can}
            takebackReason={takeback.why}
            onTakeBack={friend.takeBack}
            onLeave={friend.leave}
            onResign={friend.resign}
            onOfferDraw={friend.offerDraw}
            onAnswerDraw={friend.answerDraw}
            notice={friend.notice}
            onDismissNotice={friend.dismissNotice}
          />

          {/* Which way round the board is, and the way back to the start: the
              two that set a board up rather than move through one. */}
          <div className="board-controls">
            <ToggleField
              id="flip-board"
              label="Black at bottom"
              checked={settings.orientation === "black"}
              onChange={(flipped) =>
                setSettings({
                  ...settings,
                  orientation: flipped ? "black" : "white",
                })
              }
            />
            <button
              type="button"
              className="reset-button controls-end"
              disabled={inGame !== null}
              title={inGame ?? undefined}
              onClick={() => setPosition(DEFAULT_POSITION)}
            >
              Reset to initial position
            </button>
          </div>

          {/* Stepping through the line, and jumping anywhere in it. */}
          <div className="board-controls move-nav">
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
                aria-label="Previous position"
                disabled={!canGoPrevious(history)}
                title="Previous position"
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
            <MovesSelect
              entries={history.entries}
              current={history.current}
              onSelect={(index) => {
                const moved = goToPosition(history, index);
                setHistory(moved);
                setFen(currentPosition(moved));
              }}
            />
          </div>

          {/* Second row: what a whole game can be done with. */}
          {/* Still readable while a game is on — it is worth copying — but
              not a way to put another position on the board. */}
          <FenField
            value={fen}
            error={error}
            readOnly={inGame}
            onChange={enterPosition}
          />

          {/* The two that move a game in and out of PGN, and the link to it. */}
          <div className="board-controls">
            <span className="field-with-help">
              <button
                type="button"
                className="reset-button"
                aria-describedby="import-pgn-help"
                disabled={inGame !== null}
                title={inGame ?? undefined}
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
            <div className="controls-end">
              <CopyButton
                label="Share game"
                icon={<ShareIcon />}
                title="Copy a link that opens this game at its first position"
                text={() => {
                  const pgn = sharablePgn();
                  return pgn === null ? null : gameLink(pgn);
                }}
              />
            </div>
          </div>

          {/* Putting a game aside, and taking one back. */}
          <div className="board-controls">
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
            <StashedGames
              stash={stash}
              value={stashName}
              locked={inGame}
              onSelect={loadStashedGame}
            />
          </div>

          <div className="board-controls">
            <GameLibrary
              value={libraryGame}
              error={libraryGameError}
              locked={inGame}
              onSelect={loadLibraryGame}
            />
          </div>

          {/*
            Out here rather than in the settings panel: turning a side's marks
            off is part of reading the board, not of setting it up, and is
            reached for as often as the board is flipped.
          */}
          <div className="field-row field-row-halves">
            <ToggleField
              id="show-my-attacks"
              label="Show my attack rays"
              checked={settings.attacks.showAttacks.me}
              onChange={(me) =>
                setSettings({
                  ...settings,
                  attacks: {
                    ...settings.attacks,
                    showAttacks: { ...settings.attacks.showAttacks, me },
                  },
                })
              }
            />
            <ToggleField
              id="show-opponent-attacks"
              label="Show opponent's attack rays"
              checked={settings.attacks.showAttacks.opponent}
              onChange={(opponent) =>
                setSettings({
                  ...settings,
                  attacks: {
                    ...settings.attacks,
                    showAttacks: { ...settings.attacks.showAttacks, opponent },
                  },
                })
              }
            />
          </div>

          {/* Out here for the same reason, and in the same two columns: the
              heatmap answers "who holds this square", which is a question
              asked while reading a position, not while setting one up. Its
              colours and strength stay in the settings panel — those are
              chosen once, whereas these two are flicked on and off. */}
          <div className="field-row field-row-halves">
            <ToggleField
              id="heatmap-mine"
              hint="Colour every square my men cover, more strongly where more of them cover it."
              label="Show my attack heatmap"
              checked={settings.attacks.heatmap.showMine}
              onChange={(showMine) => showHeatmap({ showMine })}
            />
            <ToggleField
              id="heatmap-theirs"
              hint="The same for the other end of the board. With both on, a square takes a blend of the two, weighted by how many attackers each side has."
              label="Show opponent's attack heatmap"
              checked={settings.attacks.heatmap.showOpponent}
              onChange={(showOpponent) => showHeatmap({ showOpponent })}
            />
          </div>

          {settingsOpen && (
            <SettingsPanel
              settings={settings}
              defaults={DEFAULT_SETTINGS}
              onChange={setSettings}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        open={askPlainBoard}
        question="Draw the board in one colour?"
        detail={
          "The heatmap colours the squares themselves, and a checkerboard under it " +
          "gives every shade two readings. This turns on \u201CUse light square " +
          "color for dark squares\u201D, which can be turned off again \u2014 the dark " +
          "colour is kept, not overwritten."
        }
        confirmLabel="Use one colour"
        dismissLabel="Keep the checkerboard"
        onConfirm={() =>
          setSettings({
            ...settings,
            boardColors: { ...settings.boardColors, useLightForDark: true },
          })
        }
        onClose={() => setAskPlainBoard(false)}
      />

      <JoinDialog
        open={joining}
        onJoin={(gameId) => {
          setJoining(false);
          friend.goTo(gameId);
        }}
        onClose={() => setJoining(false)}
      />

      <ChallengeDialog
        open={friend.phase.kind === "challenging"}
        name={friend.name}
        // What is on the board, in case the game is to be taken up from it
        // rather than started: the whole line, not merely the position, so
        // that the moves already played stay part of the game.
        board={lineOf(history)}
        onSubmit={friend.challenge}
        // Only a dismissal abandons the challenge. A <dialog> fires `close`
        // whenever it closes, including when it closes because the game was
        // created — and calling off the game at that moment would throw away
        // the invite that had just been made.
        onClose={() =>
          friend.phase.kind === "challenging" ? friend.leave() : undefined
        }
      />

      <InviteDialog
        phase={friend.phase}
        name={friend.name}
        onAnswer={friend.answer}
        onClose={() =>
          friend.phase.kind === "invited" ? friend.leave() : undefined
        }
      />

      <PgnDialog
        open={pgnOpen}
        onSubmit={loadPgn}
        onClose={() => setPgnOpen(false)}
      />

      {/* Asked before the board changes, not after: the game is waiting to go
          up, and what is on the board now is still there to be kept. Either
          answer starts the game. */}
      <StashDialog
        open={waitingToStart !== null}
        taken={stash.map((game) => game.name)}
        initialName={`Set aside ${new Date().toLocaleDateString()}`}
        prompt={
          friend.phase.kind === "playing"
            ? `You're about to start a game with ${friend.phase.opponent}. Would you like to stash the current game?`
            : "Would you like to stash the current game?"
        }
        submitLabel="Stash"
        dismissLabel="Discard"
        onSubmit={(name) => {
          setStash(stashGame(stash, name, history));
          if (waitingToStart !== null) {
            putUp(waitingToStart);
          }
          setWaitingToStart(null);
        }}
        onClose={() => {
          if (waitingToStart !== null) {
            putUp(waitingToStart);
          }
          setWaitingToStart(null);
        }}
      />

      <StashDialog
        open={stashDialogOpen}
        taken={stash.map((game) => game.name)}
        /* A game with a friend names itself: both players, the day, and the id
           it was played under. Whatever it is already called wins, since that
           is a name somebody chose. */
        initialName={
          stashName ??
          (friend.phase.kind === "playing"
            ? friendlyGameName(
                friend.phase.you === "w" ? friend.name : friend.phase.opponent,
                friend.phase.you === "b" ? friend.name : friend.phase.opponent,
                friend.phase.gameId
              )
            : null)
        }
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
