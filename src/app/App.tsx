import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  nextStashName,
  stashGame,
  stashedGame,
  type GameStash,
} from "../chess/stash";
import { parseFen } from "../chess/position";
import { boardDuring, moveBetween, travellersOf } from "../chess/flight";
import { moveSpeed } from "../visualization/moveSpeed";
import {
  flightTime,
  squaresApart,
  type Flight,
} from "../visualization/flightPath";
import CopyButton from "./CopyButton";
import { gameLink, openingFromLocation } from "./sharing";
import Board from "../visualization/Board";
import type { LastMove } from "../visualization/layers/HighlightLayer";
import GameLibrary from "./GameLibrary";
import FenField from "./FenField";
import FieldWithHelp from "./FieldWithHelp";
import MovesSelect from "./MovesSelect";
import NumberField from "./NumberField";
import GearIcon from "./GearIcon";
import IntensityChooser from "./IntensityChooser";
import LinkIcon from "./LinkIcon";
import GitHubIcon from "./GitHubIcon";
import ShareIcon from "./ShareIcon";
import SponsorIcon from "./SponsorIcon";
import PlayIcon from "./PlayIcon";
import SectionRule from "./SectionRule";
import StepIcon from "./StepIcon";
import SettingsPanel, { type SettingsGroup } from "./SettingsPanel";
import TabBar, { type Tab } from "./TabBar";
import CapturedBar from "./CapturedBar";
import PgnDialog from "./PgnDialog";
import PgnExportDialog from "./PgnExportDialog";
import PgnHelp from "./PgnHelp";
import StashDialog from "./StashDialog";
import StashedGames from "./StashedGames";
import ToggleField from "./ToggleField";
import ChallengeDialog from "./friend/ChallengeDialog";
import InviteDialog from "./friend/InviteDialog";
import GameDetails from "./friend/GameDetails";
import { gameHere } from "./friend/connection";
import { loadGame } from "./friend/storage";
import JoinDialog from "./friend/JoinDialog";
import ForgetIcon from "./ForgetIcon";
import RefreshIcon from "./RefreshIcon";
import SavedGames from "./friend/SavedGames";
import { describeEnding } from "./friend/ending";
import { friendlyGameName } from "./friend/gameName";
import PlayerName from "./friend/PlayerName";
import { useFriendGame } from "./friend/useFriendGame";
import type { Heatmap, Settings } from "./settings";
import type { ColorChoice, Terms } from "../../worker/protocol";
import { DEFAULT_SETTINGS } from "./presets";
import type { SideIntensity } from "../visualization/settings";
import {
  heatOver,
  meanColor,
  raysOver,
} from "../visualization/intensityField";

/**
 * What the right-hand column can show. The game comes first and opens by
 * default: it is what the page is for, and the rest is how it looks.
 */
type PanelTab = "game" | "match" | "balance" | SettingsGroup;

const TABS: readonly Tab<PanelTab>[] = [
  { id: "game", label: "Game", name: "Game and view" },
  // A game against another person, which is a different thing from the game on
  // the board: it is arranged, joined, and given up, and none of that has
  // anything to say about the position or the way it is drawn.
  { id: "match", label: "Match", name: "Play against a friend" },
  // Short because the strip has to stay on one line: nine tabs that wrap cost
  // the selected one its join to the panel, which is what makes it a tab.
  { id: "balance", label: "Balance", name: "Colour balance" },
  { id: "board", label: "Board" },
  { id: "pieces", label: "Pieces" },
  { id: "rays", label: "Rays", name: "Attack rays" },
  { id: "heatmap", label: "Heatmap", name: "Attack heatmap" },
  { id: "check", label: "Check", name: "Check and checkmate" },
  { id: "pins", label: "Pin", name: "Pins" },
  // Marked rather than named: it holds the settings themselves — the file they
  // are written to and read from — rather than any setting, and a gear says
  // that in the space a word would need.
  { id: "manage", label: <GearIcon />, name: "Manage settings" },
];

export default function App() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  /*
    One colour speaks for a side's rays, though the settings keep one per piece
    kind: their mean. They are the same colour today, and the mean stays honest
    if they are ever parted.
  */
  const rayColors = useMemo(
    () => ({
      mine: meanColor(Object.values(settings.attacks.colors.me)),
      theirs: meanColor(Object.values(settings.attacks.colors.opponent)),
    }),
    [settings.attacks.colors]
  );

  // The board the fields are painted on: a light square, which is what the
  // marks are read against.
  const square = settings.boardColors.lightSquare;

  const rayFieldColor = useCallback(
    (mine: number, opponent: number) =>
      raysOver(
        square,
        rayColors.mine,
        rayColors.theirs,
        mine * settings.attacks.rayOpacity.me,
        opponent * settings.attacks.rayOpacity.opponent
      ),
    [square, rayColors, settings.attacks.rayOpacity]
  );

  /*
    What a whole one comes to, for the far corner of each chooser.

    The corners say nought and one, which is true of the fraction but says
    nothing about what a whole one is worth — and that is the number the reader
    is actually setting. The rays have an opacity apiece, so the pair is written
    out when they differ and once when they do not: two identical numbers side
    by side would read as though they were about to be told apart.
  */
  const rayFull = {
    mine: settings.attacks.rayOpacity.me,
    opponent: settings.attacks.rayOpacity.opponent,
  };
  const heatFull = {
    mine: settings.attacks.heatmap.strength.me,
    opponent: settings.attacks.heatmap.strength.opponent,
  };

  const heatFieldColor = useCallback(
    (mine: number, opponent: number) =>
      heatOver(
        square,
        settings.attacks.heatmap.color.me,
        settings.attacks.heatmap.color.opponent,
        mine * settings.attacks.heatmap.strength.me,
        opponent * settings.attacks.heatmap.strength.opponent
      ),
    [
      square,
      settings.attacks.heatmap.color.me,
      settings.attacks.heatmap.color.opponent,
      settings.attacks.heatmap.strength,
    ]
  );

  /**
   * Moving one or both choosers. Linked, whichever was moved carries the other
   * with it; parted, each keeps its own.
   */
  function setIntensity(moved: { rays?: SideIntensity; heatmap?: SideIntensity }) {
    const linked = settings.attacks.linkedIntensity;
    const next = moved.rays ?? moved.heatmap;
    const rays = linked ? next! : moved.rays ?? settings.attacks.rayIntensity;
    const heat = linked ? next! : moved.heatmap ?? settings.attacks.heatmap.intensity;
    setSettings({
      ...settings,
      attacks: {
        ...settings.attacks,
        rayIntensity: rays,
        heatmap: { ...settings.attacks.heatmap, intensity: heat },
      },
    });
  }

  /** Joining the two, which takes the rays' setting for both, or parting them. */
  function linkIntensity(linked: boolean) {
    const heat = linked
      ? settings.attacks.rayIntensity
      : settings.attacks.heatmap.intensity;
    setSettings({
      ...settings,
      attacks: {
        ...settings.attacks,
        linkedIntensity: linked,
        heatmap: { ...settings.attacks.heatmap, intensity: heat },
      },
    });
  }

  /*
    Which panel the page opens on.

    The board's own tab, unless the address names a game still being played —
    a reload of a tab that was in one, or a link followed back into one. Then it
    opens on the game: that is what the reader came back for, the panel saying
    whose move it is and who is still connected is there, and half of the
    board's tab is disabled while a game with a friend is on anyway.

    A game that is over is the other way round. There is nothing left to do to
    it, and somebody who left a tab sitting at a finished game was reading it —
    stepping the line, taking the PGN off it — which is the board's tab.

    Whether it is over is asked of the seat this browser holds, which is on hand
    at the first render where the object is a round trip away. An address naming
    a game this browser has no seat at is somebody's challenge being followed,
    and that is a game about to start rather than one already over.
  */
  const [tab, setTab] = useState<PanelTab>(() => {
    const seat = gameHere();
    if (seat === null) {
      return "game";
    }
    return loadGame(seat)?.ending === undefined ? "match" : "game";
  });
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
  /*
    Playing a game back on its own. The period is how long each position is
    left standing, in seconds — the reader's pace through the game rather than
    a piece's pace across the board, which is the moves' own setting.
  */
  const [playing, setPlaying] = useState(false);
  /* How long a position is held while a game plays itself: a setting, like the
     pace a piece travels at, and kept in the same file. */
  const period = settings.playPeriodPerPositionSec;
  /* Whether a shared link should set the game playing for whoever opens it. */
  const [shareAutoplay, setShareAutoplay] = useState(true);
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
    showPosition(currentPosition(loaded));
    /* Read in from somewhere that still has it. */
    handed.current = lineOf(loaded);
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
    showPosition(entries[0].fen);
    handed.current = {
      initialFEN,
      /* What was actually played, not what was sent: a line that stopped being
         legal partway is on the board only as far as it got. */
      moves: entries
        .slice(0, -1)
        .reverse()
        .map((entry) => entry.move ?? ""),
    };
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
    showPosition(currentPosition(game.history));
    handed.current = lineOf(game.history);
    setStashName(name);
    setLibraryGame(null);
    setLibraryGameError(null);
  }

  /**
   * A position arrived at by playing: recorded after the current one, with
   * anything that had followed dropped.
   */
  function playPosition(fen: string, move: string) {
    showPosition(fen);
    setHistory(pushPosition(history, fen, move));
  }

  /**
   * A position set outright — typed in, chosen from the examples, or reset.
   * That starts a fresh line rather than continuing one: there is no move
   * connecting it to what came before, so nothing to step back through.
   */
  function setPosition(next: string) {
    showPosition(next);
    setHistory(startHistory(next));
    /* Typed, pasted or reset: whatever follows from here is the board's own
       and nobody else's copy of it. */
    handed.current = null;
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
    showPosition(next);
  }

  /**
   * Walks the list without changing it — what the four step buttons call.
   * Whether each is available is `canGoPrevious` / `canGoNext`: reaching an end
   * of the list needs something in that direction, exactly as a step does.
   */
  function showHistory(moved: PositionHistory) {
    setHistory(moved);
    showPosition(currentPosition(moved));
  }

  function stepHistory(direction: "first" | "previous" | "next" | "last") {
    /* A hand on the controls takes the game back off the clock: whoever is
       stepping through it themselves has stopped watching it play. */
    setPlaying(false);
    const walk = { first: goFirst, previous: goPrevious, next: goNext, last: goLast };
    showHistory(walk[direction](history));
  }

  /**
   * Sets the game running, or holds it where it stands.
   *
   * A game at its last position has nothing to play, and the button is closed
   * there rather than quietly starting again from the top: whoever wants that
   * says so with the step buttons beside it.
   */
  function playOrStop() {
    setPlaying(!playing);
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

  /*
    The move being played out, if one is.

    Worked out from the two positions rather than from what was just done: a
    move arrives by several routes — played here, played by an opponent, stepped
    forward through a game — and they are all the same thing to watch. What is
    deliberately excluded is a move made by dragging, since the piece has
    already crossed the board under the pointer, and anything more than a single
    move apart, which is a jump rather than a journey.

    Two moments, and only two:

      the piece leaves    its rays and its share of the heatmap go with it,
                          both squares of the move are marked, and it sets off

      it arrives          everything else at once — whatever it took goes, that
                          piece's rays and heatmap go with it, the mover takes
                          the square, and its own rays and heatmap appear there

    A third moment, when the piece first touches the square it is going to, was
    tried and taken out. It falls a fraction of a second before the landing, and
    two changes of highlighting that close together read as a flicker rather
    than as two events. Held to the landing, the piece is seen to settle onto
    what it takes, and the board changes hands once.

    The board is shown a position of its own throughout: everything as it was,
    less whatever is in the air. Without that the rays would already be drawn
    from the square the piece has not reached yet, which is what made the first
    version read as a jump with a glyph sliding after it.
  */
  const [flight, setFlight] = useState<Flight | null>(null);
  /*
    The board shown while a move is crossing it, and the squares whose pieces
    are making the crossing. The two travel together because neither is any use
    alone: the board still holds the travelling piece, so that it goes on
    blocking, and the list is what tells the layers to draw nothing of it.
  */
  const [during, setDuring] = useState<{
    board: Chess;
    flying: Square[];
  } | null>(null);
  /* What the board is showing, as the flight planner last left it. It starts
     where the board starts: the first position is not arrived at, so nothing
     travels to it. */
  const shownFen = useRef<string>(currentPosition(history));
  const draggedTo = useRef<Square | null>(null);
  /*
    What travels when the board goes from one position to another, worked out
    where the position changes rather than noticed afterwards.

    This was a layout effect once: the position was set, React drew it, and the
    effect set the flight that holds it back before anything reached the screen.
    Nothing was ever painted wrongly — but a render happened in between, showing
    the move already made, and everything that watches the board for changes was
    told a story that was never true. The marks believed a pin appeared and went
    again, and that a taken piece's marks vanished and came back, and the fades
    grew a set of graces to wait those phantoms out.

    Called from the same handler that moves the position, all of it lands in one
    commit and there is no in-between to lie about.
  */
  function planJourney(
    before: string,
    after: string,
    dragged: Square | null
  ): { flight: Flight; during: { board: Chess; flying: Square[] } } | null {
    if (
      before === after ||
      settings.move.speed <= 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return null;
    }
    /*
      Which way the board went. Forward is a move played from what was shown;
      backward is the same move seen from the other end — the position now shown
      is the one that move was played from.

      A takeback is worth watching as much as a move is, and watching it undone
      is how a reader checks what it did. So it is played in reverse: the piece
      goes back the way it came, and whatever it took is put back on the board
      as it clears the square.
    */
    const forward = moveBetween(before, after);
    const backward = forward === null ? moveBetween(after, before) : null;
    const move = forward ?? backward;
    if (move === null || (forward !== null && move.to === dragged)) {
      return null;
    }
    const { travellers: played } = travellersOf(move);
    // Going back, each piece retraces its own journey.
    const travellers =
      forward !== null
        ? played
        : played.map((piece) => ({ ...piece, from: piece.to, to: piece.from }));
    /*
      Timed by the longest journey the move contains, not by the king's.

      Castling sends two pieces at once and they have to arrive together, being
      one move. Queenside the rook goes three squares to the king's two, so
      timing the pair by the king made the rook cover half as much ground again
      in the same time — faster than the speed that was asked for. Taking the
      longest instead, nothing ever exceeds it and the shorter piece simply
      travels more gently.
    */
    const squares = Math.max(
      ...travellers.map((piece) =>
        squaresApart(piece.from, piece.to, settings.orientation)
      )
    );
    const ms = flightTime(squares, moveSpeed(settings.move, squares));
    if (ms <= 0) {
      return null;
    }

    /*
      What the board shows while the piece is in the air, in the two stages the
      journey has.

      Forward: everything as it was before the move, less the piece travelling.
      What it takes stays until it is reached — that is what makes the arrival
      read as a capture — and goes at the moment of touching.

      Backward: everything as it is now, less the piece travelling, and less
      what it took as well, since that square is the one being left. The taken
      piece comes back as the square is cleared, which is the same moment in
      the journey seen from the other end.
    */
    /*
      One board for the whole journey: the position the move was played from,
      less whatever is in the air. Going forward that position is what was on
      screen a moment ago; going back it is what is on screen now. Either way
      the piece taken stays where it stands, and the mover is off the board
      until it lands.
    */
    const stood = forward !== null ? before : after;
    const held = boardDuring(stood);
    if (held === null) {
      return null;
    }

    return {
      flight: { travellers, ms },
      /*
        The squares the travelling pieces stand on in that position — which is
        the one the move was played from either way, forward or back, so it is
        always the move's own `from`. They stay on the board and go on blocking;
        what they no longer do is attack, and that is what naming them here
        withholds.
      */
      during: { board: held, flying: played.map((piece) => piece.from) },
    };
  }

  /**
   * The board goes to a position.
   *
   * Every route to another position comes through here — a move played, a step
   * through the list, a game loaded, a move arriving from the other player —
   * and each of them says so in the same breath as it changes the list itself.
   * That is the point of it: the position, the piece in the air and the board
   * held back behind it are three parts of one change, and a reader who saw
   * them arrive separately would be watching a flicker.
   */
  function showPosition(next: string) {
    const before = shownFen.current;
    shownFen.current = next;
    const dragged = draggedTo.current;
    draggedTo.current = null;
    const journey = planJourney(before, next, dragged);
    /*
      Set either way, so that a position reached while something was still
      travelling brings it down. Left standing it never ended: jumping to the
      start of a game mid-move once left the piece hanging over the board.
    */
    setFlight(journey?.flight ?? null);
    setDuring(journey?.during ?? null);
    setFen(next);
  }

  /*
    A long stop, not the length of the journey.

    What ends a flight is the piece arriving — the board says so, and `land`
    below is what it says it to. This is only in case it never does: an
    animation the browser refuses to run, a layer that never measured itself.
    Timed at the journey's own length it was a race against it, and one the
    board kept winning: the piece was taken off four fifths of the way there
    and the rest of its journey became a jump.
  */
  useEffect(() => {
    if (flight === null) {
      return;
    }
    const landed = window.setTimeout(() => {
      setFlight(null);
      setDuring(null);
    }, flight.ms + 2000);
    return () => window.clearTimeout(landed);
  }, [flight]);

  /*
    A link that asked for the game to play itself.

    Once, on arrival, and only when the link brought a line to play. The board
    opens at the end of the game — which is where a game read rather than
    watched should open — so this winds it back to the beginning first, and the
    pace is whatever this reader's own settings say.
  */
  useEffect(() => {
    if (opening?.autoplay !== true || opening.entries === null) {
      return;
    }
    showHistory(goFirst(history));
    setPlaying(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the opening is
    // read once, at the address the page was opened at; nothing later changes
    // what it asked for.
  }, []);

  /*
    The piece is down: the board can go back to drawing the position it was
    handed. Said by the board itself, when the last of the travelling pieces
    reaches its square.
  */
  function land() {
    setFlight(null);
    setDuring(null);
  }

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
      showPosition(after);
      if (handed.current !== null) {
        handed.current = {
          ...handed.current,
          moves: [...handed.current.moves, san],
        };
      }
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
      showPosition(back);
      if (handed.current !== null) {
        handed.current = {
          ...handed.current,
          moves: handed.current.moves.slice(0, -1),
        };
      }
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
      /* Still what it was handed, so it is a game that is kept elsewhere and
         there is nothing here to lose. Moving between games in the list is this
         case every time, and it was stopping to ask on every one of them. */
      const asHanded =
        handed.current !== null &&
        handed.current.initialFEN === here.initialFEN &&
        handed.current.moves.join(" ") === here.moves.join(" ");
      if (same) {
        /*
          The line the board already holds. Putting it up again would rebuild it
          and leave the reader at its head — which is where they were not: a
          game in progress can be walked back through, and a `state` arriving
          from a reconnection would have snatched the board back to the last
          move every time it did.
        */
        return;
      }
      if (!asHanded && history.entries.length > 1 && stashName === null) {
        setWaitingToStart({ initialFEN, moves });
        return;
      }
      putUp({ initialFEN, moves });
    },
  });
  const [joining, setJoining] = useState(false);
  /*
    Whether the list of games is open, and which of them are ticked for
    forgetting. The list is a way about the games this browser holds rather than
    a thing to be in: it opens under the game being shown, and closes again.
  */
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  /*
    Whether a game is already on the board. What it decides is not whether
    another game may be started — it may — but which way round: the game in
    front of the reader keeps the connection, and anything else is arranged on
    a line of its own and left in the list.
  */
  const aside = friend.phase.kind === "playing" && friend.phase.over === null;
  /* Where the panel was when the challenge dialog was opened, so that thinking
     better of it puts the reader back rather than nowhere. */
  const [wasShowing, setWasShowing] = useState<string | null>(null);
  /*
    Whether the board has players' names above and below it.

    A game being opened counts, not only one already open. Going from one game
    to another passes through the moment of being at neither, and reading that
    moment honestly — no game, so no names — took the two rows away, let the
    board grow into the space, and put them back a fraction of a second later.
    The reader sees the board jump out and back for every switch.

    So the space is held while a game is on its way. The names in it are the new
    game's when they arrive; until then the rows stand empty, which is a blank
    where a name will be rather than the board moving twice.
  */
  const atAGame =
    friend.phase.kind === "playing" || friend.phase.kind === "opening";
  const named =
    friend.phase.kind === "playing"
      ? {
          you: friend.phase.you,
          opponent: friend.phase.opponent,
        }
      : null;
  /** A challenge being looked at while another game is being played. */
  const [considering, setConsidering] = useState<{
    gameId: string;
    challenger: string;
    you: ColorChoice;
    terms: Terms;
  } | null>(null);
  const [asideTrouble, setAsideTrouble] = useState<string | null>(null);
  /*
    Read afresh whenever it is opened, and whenever this tab arrives at or
    leaves a game — the two moments when what the list says may have stopped
    being true. Nothing polls: a list nobody is looking at is not worth a socket
    a minute, and the button beside it is there for a reader who wants to be
    sure.
  */
  const readGames = friend.readGames;
  /*
    Coming back to the game's own tab.

    While a game is on, the board is free to be walked back through: nothing can
    be sent from a position that is not the last one, so stepping about in it is
    reading rather than playing. Coming back here is coming back to play, so the
    board catches up to the move the game is actually at.

    And if what is on the board is no longer that game — a PGN read in, a line
    played out by hand on the other tab — that is asked about before the game
    goes back up, in the same words as anywhere else something made here is
    about to be replaced.
  */
  useEffect(() => {
    if (
      tab !== "match" ||
      friend.phase.kind !== "playing" ||
      handed.current === null
    ) {
      return;
    }
    const here = lineOf(history);
    const game = handed.current;
    const same =
      here.initialFEN === game.initialFEN &&
      here.moves.join(" ") === game.moves.join(" ");
    if (same) {
      if (history.current !== 0) {
        showHistory({ ...history, current: 0 });
      }
      return;
    }
    if (history.entries.length > 1 && stashName === null) {
      setWaitingToStart(game);
      return;
    }
    putUp(game);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the board and the
    // game it is showing are what this watches; the helpers it calls are the
    // component's own and are the same on every render.
  }, [tab, friend.phase.kind, history, stashName]);

  /*
    The list is read from the server when it comes on screen, and not again
    until somebody asks.

    Reading it is a socket per saved game, and it used to be done again on
    every phase change as well — which meant going from one game to another,
    two phase changes, asked every game in the list twice over to learn about
    the one that was clicked. Everything those readings were for now comes from
    the game itself, on the connection already open to it: a move, an ending,
    the state on arriving. Refresh is there for the rest of the list, and says
    what it is doing.
  */
  useEffect(() => {
    if (tab === "match") {
      void readGames();
    }
  }, [tab, readGames]);
  /**
   * A game that has begun but is not on the board yet, because what is on the
   * board has not been dealt with. Held until the question is answered, and
   * only then put up.
   */
  /**
   * The line the board was handed, by whoever handed it one.
   *
   * A game put up from the list, a game from the library, a stash taken out, a
   * PGN pasted in, a line a link carried: all of them are kept somewhere other
   * than the board, and none of them is worth asking whether to keep. What is
   * worth asking about is what somebody made here — moves played on the board
   * by hand, a position typed in — and that is exactly what this tells apart:
   * the board holding something other than what it was handed.
   *
   * Kept level with the game while it is played, since a move of one's own in a
   * game with a friend is the object's move as much as the board's. Otherwise
   * the first move of a game would have made the board look like an afternoon's
   * work, and switching to another game would have stopped to ask about it.
   */
  const handed = useRef<{ initialFEN: string; moves: string[] } | null>(
    lineOf(history)
  );

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
    One position at a time, each left standing for its period.

    The timer is set again on every change of position, which is what makes the
    game walk forward: each step changes `history`, this runs again, and the
    next step is booked. It ends itself at the last position — there is nothing
    to step to, and a game that has played to its end has stopped.

    The period is the time a position stands still, and nothing else: it is
    counted from the moment a piece lands to the moment the next one sets off,
    so a move slower than the period is not cut in half by the next one. What a
    move takes is the move's own business — the two settings then say what they
    sound like, one how long a move takes and the other how long the board rests
    between moves, rather than one silently eating the other.
  */
  useEffect(() => {
    if (!playing) {
      return;
    }
    /* A game with a friend is played, not watched: the moves arrive as they are
       made, and walking the line on a timer would take the board away from
       whoever is waiting to move on it. */
    if (inGame !== null) {
      setPlaying(false);
      return;
    }
    if (!canGoNext(history)) {
      setPlaying(false);
      return;
    }
    /* Still travelling: the clock has not started. It starts when the board
       says the piece is down, which clears this and runs it again. */
    if (flight !== null) {
      return;
    }
    /*
      A quarter of the period on the opening position. A game nearly always
      starts from the same board, and holding the one position every reader
      already knows for as long as the ones they are watching for makes the
      start of every playback a wait.
    */
    const share = canGoPrevious(history) ? 1 : 0.25;
    const wait = Math.max(period, 0.1) * 1000 * share;
    const next = window.setTimeout(() => showHistory(goNext(history)), wait);
    return () => window.clearTimeout(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `showHistory`
    // only sets state; taking it as a dependency would book a fresh timer on
    // every render and the game would never reach the end of a period.
  }, [playing, history, period, inGame, flight]);

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
  function handleMove(from: Square, to: Square, dragged = false) {
    if (shown === null) {
      return;
    }
    /*
      Noted for the flight below, which skips a move the hand has already made:
      a dragged piece crossed the board under the pointer and is put down where
      it was let go, so playing the journey again would be showing it twice.
    */
    if (dragged) {
      draggedTo.current = to;
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
        atAGame ? "app app-playing" : "app"
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
              {atAGame && (
                <PlayerName
                  name={
                    named === null
                      ? ""
                      : farSide === named.you
                        ? friend.name
                        : named.opponent
                  }
                  color={farSide}
                  mine={named !== null && farSide === named.you}
                />
              )}
              <div className="board-with-captured">
                <Board
                position={shown}
                colors={settings.boardColors}
              hedge={settings.hedge}
                pieceTint={settings.pieceTint}
                attacks={settings.attacks}
                fadeTimeMs={settings.fadeTimeMs}
                onMove={handleMove}
                flight={flight}
                onFlightLanded={land}
                showing={during?.board ?? null}
                flying={during?.flying ?? []}
                grid={settings.grid}
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
              {atAGame && (
                <PlayerName
                  name={
                    named === null
                      ? ""
                      : nearSide === named.you
                        ? friend.name
                        : named.opponent
                  }
                  color={nearSide}
                  mine={named !== null && nearSide === named.you}
                />
              )}
            </div>
          )}
        </section>

        {/* Right: everything else, stacked, in the order it is reached for. */}
        <div className="side-column">
          {/* Strip and panel are one thing, so they are wrapped as one: as
              separate children of the column the flex gap would put a space
              between the selected tab and what it opens. */}
          <div className="tabbed">
          {/*
            One column, six tabs. The panel was a single column of everything
            at once, which made the setting being looked for a question of how
            far down it was, and pushed the game's own controls off the screen
            whenever the settings were open.
          */}
          <TabBar
            tabs={TABS}
            active={tab}
            label="Game and settings"
            onSelect={setTab}
          />

          {/*
            Hidden rather than unmounted: this panel holds half-typed FENs and a
            move list scrolled to where the reader left it, and a glance at the
            settings should not throw either away.
          */}
          <div
            className="tab-panel tab-panel-flush"
            role="tabpanel"
            id="panel-game"
            aria-labelledby="tab-game"
            hidden={tab !== "game"}
          >
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

            <SectionRule name="Moves and position" />

            {/* Stepping through the line, letting it play itself, and jumping
                anywhere in it — a row apiece, in that order: the two ways of
                going one position at a time stand together, and the list of
                every position stands under both. */}
            <div className="move-nav">
              <div className="board-controls step-buttons">
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
              <div className="board-controls play-row">
                <button
                  type="button"
                  className="reset-button play-button"
                  title={
                    inGame ??
                    (playing
                      ? "Hold the game where it stands"
                      : "Play the game through, a position at a time — from wherever it stands")
                  }
                  aria-pressed={playing}
                  /* Nothing ahead of it is nothing to play: at the last
                     position the button has no work to do, and saying so is
                     better than starting the game again from the top under a
                     word that promises to carry on. */
                  disabled={inGame !== null || (!playing && !canGoNext(history))}
                  onClick={playOrStop}
                >
                  <PlayIcon playing={playing} />
                  {playing ? "Pause / Stop" : "Play / Resume"}
                </button>
                <NumberField
                  id="play-period"
                  inline
                  narrow
                  label="Period per position"
                  suffix="seconds"
                  step={0.5}
                  value={period}
                  disabled={inGame !== null}
                  hint={
                    inGame ??
                    "How long each position is left on the board while the game plays."
                  }
                  onChange={(playPeriodPerPositionSec) =>
                    setSettings({ ...settings, playPeriodPerPositionSec })
                  }
                />
              </div>
              <div className="board-controls">
                <MovesSelect
                  entries={history.entries}
                  current={history.current}
                  onSelect={(index) => {
                    setPlaying(false);
                    showHistory(goToPosition(history, index));
                  }}
                />
              </div>
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

            <SectionRule name="Import / export" />

            {/* The two that move a game in and out of PGN, and the link to it. */}
            <div className="board-controls">
              <FieldWithHelp>
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
              </FieldWithHelp>
              <FieldWithHelp>
                <button
                  type="button"
                  className="reset-button"
                  aria-describedby="export-pgn-help"
                  onClick={() => setPgnExportOpen(true)}
                >
                  Export game (PGN)
                </button>
                <PgnHelp id="export-pgn-help" />
              </FieldWithHelp>
              <div className="controls-end share-actions">
                <ToggleField
                  id="share-autoplay"
                  label="With autoplay"
                  hint="The link sets the game playing from its first position, at whatever pace the reader's own settings say."
                  checked={shareAutoplay}
                  onChange={setShareAutoplay}
                />
                <CopyButton
                  label="Share game"
                  icon={<ShareIcon />}
                  title={
                    shareAutoplay
                      ? "Copy a link that plays this game through from its first position"
                      : "Copy a link that opens this game at its first position"
                  }
                  text={() => {
                    const pgn = sharablePgn();
                    return pgn === null ? null : gameLink(pgn, shareAutoplay);
                  }}
                />
              </div>
            </div>

            <SectionRule name="Stash" />

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

            <SectionRule name="Library" />

            <div className="board-controls">
              <GameLibrary
                value={libraryGame}
                error={libraryGameError}
                locked={inGame}
                onSelect={loadLibraryGame}
              />
            </div>

          </div>

          <div
            className="tab-panel"
            role="tabpanel"
            id="panel-match"
            aria-labelledby="tab-match"
            hidden={tab !== "match"}
          >
                {/* Offering a game, and taking one up. */}
              <div className="board-controls match-actions">
                {/*
                  Neither of these is barred by a game already being played. A
                  browser holds as many seats as it likes and shows one of them;
                  a game begun or taken up while another is on the board joins
                  the list rather than pushing that one off it, and is there to
                  be gone to when its turn comes.
                */}
                <button
                  type="button"
                  className="reset-button"
                  title={
                    aside
                      ? "Offer another game; it joins the list below"
                      : undefined
                  }
                  onClick={() => {
                    setWasShowing(friend.showingSeat);
                    friend.start();
                  }}
                >
                  Send a challenge {"\u2026"}
                </button>
                <button
                  type="button"
                  className="reset-button"
                  title={
                    aside
                      ? "Take up another game; it joins the list below"
                      : "Enter the id somebody read out to you"
                  }
                  onClick={() => setJoining(true)}
                >
                  Accept a challenge {"\u2026"}
                </button>
              </div>

              {/* Under the two things this tab does, and above everything that
                  changes with the game being shown. It is about the view rather
                  than about any one game, so it keeps its place whether a game
                  is on the board, a list is open under it, or neither: a switch
                  that moves about is a switch that has to be looked for. */}
              <div className="board-controls match-view">
                <ToggleField
                  id="flip-board-match"
                  label="Black at bottom"
                  checked={settings.orientation === "black"}
                  onChange={(flipped) =>
                    setSettings({
                      ...settings,
                      orientation: flipped ? "black" : "white",
                    })
                  }
                />
              </div>

              {/*
                Older than the game it is in, and nothing it does will work until
                it is reloaded. Said where every other thing about the game is
                said, and shown whether or not a game is on — the page is what is
                out of date, not the game.
              */}
              {friend.outdated && (
                <aside className="invite-panel invite-alert" role="alert">
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

              <GameDetails
                phase={friend.phase}
                link={friend.link}
                myName={friend.name}
                /* The line on the board is the game's line while one is being
                   played, so this is what the object holds, counted here. */
                movesPlayed={Math.max(history.entries.length - 1, 0)}
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


            {asideTrouble !== null && (
              <aside className="invite-panel invite-alert" role="alert">
                <p className="invite-note">{asideTrouble}</p>
                <div className="pgn-dialog-actions">
                  <button
                    type="button"
                    className="reset-button"
                    onClick={() => setAsideTrouble(null)}
                  >
                    Close
                  </button>
                </div>
              </aside>
            )}

            {/*
              The other games, under the one being shown, and always there when
              there are any: it stood behind a button for a while, and a list
              one has to ask for is a list one forgets is holding anything.
            */}
            {friend.games.length > 0 && (
              <section className="invite-panel games-panel" aria-label="Your games">
                <p className="invite-heading">Your games</p>
                <div className="games-scroll">
                  <SavedGames
                    games={friend.games}
                    standings={friend.standings}
                    showingSeat={friend.showingSeat}
                    chosen={ticked}
                    asked={friend.asked}
                    onOpen={(seat) => {
                      setTicked(new Set());
                      friend.rejoin(seat);
                    }}
                    onChoose={(seat, on) =>
                      setTicked((was) => {
                        const next = new Set(was);
                        if (on) {
                          next.add(seat);
                        } else {
                          next.delete(seat);
                        }
                        return next;
                      })
                    }
                  />
                </div>
                {!friend.reachedThem && (
                  <p className="invite-note">
                    The server could not be reached. Games that were being
                    played are marked in red and shown as they were last seen;
                    everything else here is settled and cannot have changed.
                  </p>
                )}
                <div className="board-controls games-actions">
                  {/* The two answers to "what now" about this list, at one
                      width and held together: see `.button-pair`. */}
                  <div className="button-pair games-pair">
                  <button
                    type="button"
                    className="reset-button"
                    disabled={ticked.size === 0}
                    title={
                      ticked.size === 0
                        ? "Tick the games to forget"
                        : "Forget them in this browser; they stay on the server"
                    }
                    onClick={async () => {
                      const going = [...ticked];
                      /*
                        Whether the board is about to be showing a game this
                        browser no longer holds. It goes with the seat: a line
                        left standing there is a game nobody can play on, in a
                        panel that no longer names it — and the next game to
                        start would ask whether to stash it, which is asking
                        whether to keep something already given up.
                      */
                      const showing =
                        friend.showingSeat !== null &&
                        going.includes(friend.showingSeat);
                      setTicked(new Set());
                      await friend.forgetSelected(going);
                      if (showing) {
                        setPosition(DEFAULT_POSITION);
                      }
                    }}
                  >
                    <ForgetIcon />
                    Forget selected
                  </button>
                  <button
                    type="button"
                    className="reset-button"
                    disabled={friend.reading}
                    title="Ask every game how it stands now"
                    onClick={() => void friend.readGames()}
                  >
                    <RefreshIcon />
                    {friend.reading ? "Refreshing …" : "Refresh"}
                  </button>
                  </div>
                </div>
              </section>
            )}

          </div>

          {tab === "balance" && (
            <div
              className="tab-panel"
              role="tabpanel"
              id="panel-balance"
              aria-labelledby="tab-balance"
            >
              {/*
                Out here rather than in the settings panel: how much of each
                side's marks to draw is part of reading the board, not of setting
                it up, and is reached for as often as the board is flipped. What
                the marks are made of — their colours, their full opacity, the
                heatmap's strength — stays in the settings, and these two say what
                fraction of it to show.
              */}
              <div className="intensity-row">
                <IntensityChooser
                  id="ray-intensity"
                  label="Attack rays:"
                  value={settings.attacks.rayIntensity}
                  colorAt={rayFieldColor}
                  full={rayFull}
                  onChange={(rayIntensity) => setIntensity({ rays: rayIntensity })}
                />
                {/* Level with the two squares, which now sit on the middle of
                    the panel — as this does, the holder being full height. */}
                <div className="intensity-link-holder">
                  <div className="intensity-link-middle">
                    <button
                      type="button"
                      className="intensity-link"
                      aria-pressed={settings.attacks.linkedIntensity}
                      title={
                        settings.attacks.linkedIntensity
                          ? "Rays and heatmap move together. Press to part them."
                          : "Rays and heatmap move separately. Press to hold them equal, at the rays' setting."
                      }
                      onClick={() =>
                        linkIntensity(!settings.attacks.linkedIntensity)
                      }
                    >
                      <LinkIcon closed={settings.attacks.linkedIntensity} />
                    </button>
                  </div>
                </div>
                <IntensityChooser
                  id="heatmap-intensity"
                  label="Heatmap:"
                  value={settings.attacks.heatmap.intensity}
                  colorAt={heatFieldColor}
                  full={heatFull}
                  onChange={(intensity) => setIntensity({ heatmap: intensity })}
                />
              </div>
            </div>
          )}

          {tab !== "game" && tab !== "match" && tab !== "balance" && (
            <div
              /* The rays are the longest of the settings groups and open with a
                 row of their own rather than with a name, so they keep the thin
                 top the named panels have: the height is worth more there than
                 the margin is. */
              className={`tab-panel${tab === "rays" ? " tab-panel-tight" : ""}`}
              role="tabpanel"
              id={`panel-${tab}`}
              aria-labelledby={`tab-${tab}`}
            >
              <SettingsPanel
                group={tab}
                settings={settings}
                defaults={DEFAULT_SETTINGS}
                onChange={setSettings}
              />
            </div>
          )}
          </div>
        </div>
      </div>

      <JoinDialog
        open={joining}
        onJoin={async (gameId) => {
          setJoining(false);
          if (!aside) {
            friend.goTo(gameId);
            return;
          }
          /* Looked at on a line of its own, so the game on the board keeps
             the one it has. */
          const looked = await friend.lookAside(gameId);
          if (looked === null) {
            setAsideTrouble(
              "That challenge could not be opened. It may have been answered, taken back, or the number may be wrong."
            );
            return;
          }
          setConsidering(looked);
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
        /*
          A challenge takes the board, whatever was on it. Offering a game means
          handing somebody its link, and the link is on the panel of the game
          being shown — arranged quietly in the background, a challenge would
          have been made that nobody could send. What it replaces is not lost:
          the game that was showing is in the list, a click away.
        */
        onSubmit={friend.challenge}
        onName={friend.remember}
        // Only a dismissal abandons the challenge. A <dialog> fires `close`
        // whenever it closes, including when it closes because the game was
        // created — and calling off the game at that moment would throw away
        // the invite that had just been made.
        onClose={() => {
          if (friend.phase.kind !== "challenging") {
            return;
          }
          /* Only a dismissal gets here while the phase is still `challenging`:
             a challenge that was sent has already moved on. So this is somebody
             thinking better of it, and what they were looking at before comes
             back. */
          friend.leave();
          if (wasShowing !== null) {
            friend.rejoin(wasShowing);
          }
        }}
      />

      <InviteDialog
        phase={
          considering === null
            ? friend.phase
            : { kind: "invited", ...considering }
        }
        name={friend.name}
        onName={friend.remember}
        onAnswer={async (accept, name, color) => {
          if (considering !== null) {
            const looked = considering;
            setConsidering(null);
            await friend.answerAside(looked, accept, name, color);
            return;
          }
          /* Taking a challenge up puts the reader in a game, and the panel that
             says whose move it is — and what may be done about it — is the one
             they now want in front of them. A challenge reached by its link
             opens on whatever tab the page starts on, which is not that one. */
          if (accept) {
            setTab("match");
          }
          friend.answer(accept, name, color);
        }}
        onClose={() => {
          if (considering !== null) {
            setConsidering(null);
            return;
          }
          if (friend.phase.kind === "invited") {
            friend.leave();
          }
        }}
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
        initialName={nextStashName(stash.map((game) => game.name))}
        /* What is actually at stake, which is never the game about to go up —
           that one is on the server and in the list. It is what is on the board
           now: a line somebody made here, which nothing else has a copy of. */
        prompt={
          "The board holds a position you made here, and it is about to be " +
          "replaced. Would you like to stash it first?"
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
            : /* Nothing names this one, so the day does — and says which of
                 the day's it is, where there is more than one. */
              nextStashName(stash.map((game) => game.name)))
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
