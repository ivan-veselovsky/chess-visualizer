import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { CSSProperties } from "react";
import { flushSync } from "react-dom";
import { Chess, DEFAULT_POSITION, type Color, type Square } from "chess.js";
import { glyphSet } from "../visualization/glyphSets";
import PieceGlyph from "../visualization/PieceGlyph";
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
import {
  lineIndex,
  linesOf,
  lineTree,
  pathSoFar,
  playInto,
  readTree,
  resultShown,
  sharedMoves,
  soleLine,
  tourIndex,
  tourPlaces,
  walk,
  withoutLinesBefore,
  writeMovetext,
  type MoveTree,
  type Step,
  type TreeLine,
} from "../chess/variations";
import { capturesUpTo } from "../chess/captures";
import { applyMove, isPromotion, type PromotionPiece } from "../chess/moves";
import {
  parsePgn,
  resultOnBoard,
  toPgn,
  UNNAMED,
  type PgnEnding,
  type PgnPlayers,
} from "../chess/pgn";
import type { LibraryGame } from "../chess/gameLibrary";
import {
  nextStashName,
  stashGame,
  stashedGame,
  type GameStash,
} from "../chess/stash";
import {
  clearStash,
  loadStash,
  mergeStash,
  saveStash,
  strangeNames,
} from "./stashStore";
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
import InfoButton from "./InfoButton";
import MovesSelect from "./MovesSelect";
import NumberField from "./NumberField";
import GearIcon from "./GearIcon";
import ClapperboardIcon from "./ClapperboardIcon";
import type { GifDriver } from "./gif/capture";
import IntensityChooser from "./IntensityChooser";
import LinkIcon from "./LinkIcon";
import GitHubIcon from "./GitHubIcon";
import ShareIcon from "./ShareIcon";
import SponsorIcon from "./SponsorIcon";
import PlayIcon from "./PlayIcon";
import SectionRule from "./SectionRule";
import StepIcon from "./StepIcon";
import SelectField from "./SelectField";
import SettingsPanel, { type SettingsGroup } from "./SettingsPanel";
import TabBar, { type Tab } from "./TabBar";
import AvailableBar from "./AvailableBar";
import { keyboardIsOn } from "./keyboardOn";
import { reducedMotion } from "../visualization/motion";
import CapturedBar from "./CapturedBar";
import PgnDialog from "./PgnDialog";
import PgnExportDialog from "./PgnExportDialog";
import PgnHelp from "./PgnHelp";
import PromotionChooser from "./PromotionChooser";
import BoardEditorPalette, { EditorSignal, EditorTurn, type BoardEditorTool } from "./BoardEditorPalette";
import { asBoardEditorPosition, place, boardEditorProblems, boardEditorWarnings, shift, TWO_KINGS, turnOf, withTurn } from "../chess/boardEditor";
import { pieceVars } from "../visualization/pieceVars";
import StashDialog from "./StashDialog";
import StashedGames from "./StashedGames";
import ToggleField from "./ToggleField";
import ChallengeDialog from "./friend/ChallengeDialog";
import InviteDialog from "./friend/InviteDialog";
import GameDetails from "./friend/GameDetails";
import { gameHere } from "./friend/connection";
import { loadGame, seatOf } from "./friend/storage";
import JoinDialog from "./friend/JoinDialog";
import ForgetIcon from "./ForgetIcon";
import RefreshIcon from "./RefreshIcon";
import SavedGames from "./friend/SavedGames";
import { describeEnding } from "./friend/ending";
import { friendlyGameName } from "./friend/gameName";
import PlayerName from "./friend/PlayerName";
import { useFriendGame } from "./friend/useFriendGame";
import type { Heatmap, Settings } from "./settings";
import { OPPONENT_CHOOSES } from "../../worker/protocol";
import type { ColorChoice, Terms } from "../../worker/protocol";
import { PRESETS, STARTING_PRESET } from "./presets";
import { boardSide, setBoardSide } from "./boardSide";
import LockIcon from "./LockIcon";
import ExitIcon from "./ExitIcon";
import type { Orientation } from "../visualization/geometry";
import { loadSettings } from "./settingsStore";
import { usePresets, nameTrouble } from "./usePresets";
import { asking, setAsking } from "./asking";
import {
  setTwoBoardMode,
  setTwoBoardPreset,
  twoBoardMode,
  twoBoardPreset,
} from "./twoBoard";
import SaveAsDialog from "./SaveAsDialog";
import PresetList from "./PresetList";
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
type PanelTab = "game" | "match" | "balance" | "gif" | SettingsGroup;

/**
 * Every line of a game read from a PGN — each way through its variations — or
 * the one line it has, where it has none.
 *
 * The main line comes first, and it has to be the line the board was given:
 * that is read by chess.js, and the variations by `readTree`. Should the two
 * ever disagree about the main line, the variations are let go rather than
 * trusted — a game with one line and no surprises is better than one whose
 * branches start from a board it was never on.
 */
function gameLines(pgn: string, given: PositionHistory): TreeLine[] {
  const tree = readTree(pgn);
  const lines = tree === null ? [] : linesOf(tree);
  const main = lineOf(given);
  if (
    lines.length === 0 ||
    lines[0].entries[lines[0].entries.length - 1].fen !== main.initialFEN ||
    lines[0].moves.join(" ") !== main.moves.join(" ")
  ) {
    return [soleLine(given.entries, main.moves)];
  }
  return lines;
}

/*
  Fetched the first time its tab is opened rather than with the page: making a
  GIF is something a reader does now and then, and the encoder and the rest of
  it are no reason for everybody else's page to be bigger.
*/
const GifExportPanel = lazy(() => import("./GifExportPanel"));


const TABS: readonly Tab<PanelTab>[] = [
  // Where a position is worked on: set up, stepped through, played out against
  // nobody, shared. "Lab" rather than "Game" because the tab beside it is a
  // game too, and the words said nothing about which of them held the person.
  { id: "game", label: "Lab", name: "Lab: the game and the view" },
  // A game against another person, which is a different thing from the game on
  // the board: it is arranged, joined, and given up, and none of that has
  // anything to say about the position or the way it is drawn. Named for what
  // is on the other end of it — somebody, now — rather than for the game.
  { id: "match", label: "Live", name: "Live: play against a friend" },
  // Short because the strip has to stay on one line: nine tabs that wrap cost
  // the selected one its join to the panel, which is what makes it a tab.
  { id: "balance", label: "Balance", name: "Colour balance" },
  { id: "board", label: "Board" },
  { id: "pieces", label: "Pieces" },
  { id: "rays", label: "Rays", name: "Attack rays" },
  { id: "heatmap", label: "Heatmap", name: "Attack heatmap" },
  { id: "check", label: "Check", name: "Check and checkmate" },
  { id: "pins", label: "Pin", name: "Pins" },
  // What the board is made into rather than how it is drawn, so it stands
  // apart from the settings, beside the gear; marked, like the gear, since the
  // strip has no room left for a word.
  { id: "gif", label: <ClapperboardIcon />, name: "Animated GIF export" },
  // Marked rather than named: it holds the settings themselves — the file they
  // are written to and read from — rather than any setting, and a gear says
  // that in the space a word would need.
  { id: "manage", label: <GearIcon />, name: "Manage settings" },
];

/**
 * One side's switch, in the gap between the two choosers.
 *
 * No written label: it stands level with the reading it answers for — "Me" at
 * the bottom of each square, "Opponent" at the top — and those say which side
 * it is. The name a screen reader is given says it in words, there being no
 * column to read it off.
 *
 * Indeterminate where the two pictures disagree, which only a hand-written file
 * can arrange: the box then shows neither state rather than picking one of them
 * to show as the truth.
 */
function SideSwitch({
  side,
  of,
}: {
  side: "Mine" | "Opponent";
  of: { both: boolean; mixed: boolean; set: (shown: boolean) => void };
}) {
  const box = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (box.current !== null) {
      box.current.indeterminate = of.mixed;
    }
  }, [of.mixed]);

  const name = side === "Mine" ? "my" : "the opponent's";
  return (
    <input
      ref={box}
      type="checkbox"
      className="intensity-side-switch"
      checked={of.both}
      aria-label={`Draw ${name} rays and heatmap`}
      title={
        of.mixed
          ? `${side === "Mine" ? "My" : "The opponent's"} rays and heatmap disagree. Press to draw both.`
          : of.both
            ? `Drawing ${name} rays and heatmap. Press to leave that side out.`
            : `Leaving ${name} rays and heatmap out. Press to draw them.`
      }
      onChange={() => of.set(!of.both)}
    />
  );
}

export default function App() {
  /*
    The settings this browser was last using, read before the first paint
    rather than after it.

    In the initial state and not in an effect: an effect runs after the page is
    on the screen, so the board would be painted in the default colours and
    repainted in the reader's a moment later — a flash of somebody else's
    settings every time the app opens. Anything unreadable — a version this
    build has moved past, a record cut short — leaves the defaults standing.
  */
  /*
    Which way round the board faces, which is where the reader is sitting
    rather than anything about how the board is drawn — see `boardSide`. Read
    here, in the initial state, so the first paint is already the right way
    round.
  */
  const [side, setSide] = useState<Orientation>(boardSide);
  const turnBoard = useCallback((wanted: Orientation) => {
    setSide(wanted);
    setBoardSide(wanted);
  }, []);

  const [opened] = useState(loadSettings);
  /* The settings the board opens with: those last in use, or — in a browser
     that has none yet — the preset it opens on. */
  const [settings, setSettings] = useState<Settings>(
    () => opened.working ?? STARTING_PRESET.settings
  );

  /*
    And kept, under whatever name they are being used: the presets, the one in
    hand, and everything not saved yet. Writing is the store's business and the
    rules are `usePresets`; from here it is one hook and a list.
  */
  const presets = usePresets({ settings, apply: setSettings, opened });
  /** Presets ticked for removal, as games are ticked for forgetting. */
  const [tickedPresets, setTickedPresets] = useState<Set<string>>(new Set());
  /** Whether the Save as dialog was opened from the button rather than a
      question about settings with nowhere to go. */
  const [namingPreset, setNamingPreset] = useState(false);
  const [askBeforeDiscard, setAskBeforeDiscard] = useState(asking);
  /*
    The second board, and which preset draws it. Both live in this browser
    rather than in the settings; see `twoBoard.ts` for why.
  */
  const [twoBoard, setTwoBoard] = useState(twoBoardMode);
  /*
    The Lab's "Keep variations": moves played on the board are kept as a tree
    rather than as one line. A move from an earlier position does not throw away
    what came after it there; it starts another branch, and every branch is
    still there to walk, play and export. Off, the board holds one line, as it
    always has. See `playInTree`.
  */
  /* On to begin with: a move tried from an earlier position is kept rather than
     lost, which is what a reader working through a task wants more often than
     not; switching it off is the way back to one line. */
  const [treeMode, setTreeMode] = useState(true);
  /*
    Whether the board editor is open, and what is chosen in its palette; and
    whether it is waiting on the reader to say whether the game on the board is
    stashed first. See `openEditor`.
  */
  const [editor, setEditor] = useState(false);
  const [tool, setTool] = useState<BoardEditorTool | null>(null);
  const [stashingForEditor, setStashingForEditor] = useState(false);
  /* The positions the editor has been through, for Undo, and the ones undone,
     for Redo: emptied as it opens and closes. */
  const [editorPast, setEditorPast] = useState<string[]>([]);
  const [editorFuture, setEditorFuture] = useState<string[]>([]);
  /*
    A pawn's move to the last rank, waiting for the reader to say what it
    becomes; see `PromotionChooser`. Held with the position it was made in, so
    an answer that comes after the board has moved on is not played on a
    position it was not asked about.
  */
  const [promoting, setPromoting] = useState<{
    from: Square;
    to: Square;
    color: Color;
    fen: string;
    /** Which board it was played on, the left or the right: the chooser stands at its square. */
    board: number;
  } | null>(null);
  /* Which of the two boards last had a piece picked up on it: the other lets go
     of whatever it had picked out, so there is one piece in hand at a time. */
  const [inHand, setInHand] = useState<"left" | "right" | null>(null);
  /*
    An animated GIF being made. The board is the export's while it runs: it is
    stepped through the game and its animations held and set by hand, so the
    board and the tabs are closed to the reader until it is done. Held in a ref
    as well, for the one reader of it that is not a render — the stop that lands
    a piece whose flight has gone on too long, which an export's frames, made
    slower than the flight they show, would otherwise set off.
  */
  const [exporting, setExporting] = useState(false);
  const exportingRef = useRef(false);
  const [rightPreset, setRightPreset] = useState(twoBoardPreset);
  /*
    Every preset the classic board could be drawn with, and the one it is.

    The ones this build cannot read are left off the list: a row that is there
    to say "these are from another version" is not something to draw a board
    from. What is left is the built-ins and the reader's own.

    Until the reader chooses one, the classic board is drawn in Classic green: a
    second board is there to be set against the first, and one that opened in
    the same colours as the first would have nothing to show until somebody
    went and found the switch. It used to take the first row of the list,
    which is the preset the app opens with — so for nearly everybody, the very
    set the main board was already in.

    For the same reason, a main board already in Classic green gets the
    default set on the right instead. And once a preset has been chosen,
    neither applies: the choice stands, whatever the main board is doing.

    The two are looked up by the built-ins' ids rather than their names, which
    are what the list shows and can be reworded.

    A name can stop answering — a preset deleted in another tab, or one from a
    choice made before it was — so the name is checked against the list rather
    than trusted, and the same default stands in for one that no longer does.
    The stored answer is left alone: the reader chose it, and a preset that
    comes back is a preset they get back.
  */
  const rightChoices = presets.rows
    .filter((row) => row.fromVersion === undefined)
    .map((row) => row.name);
  const builtInNamed = (id: string) =>
    PRESETS.find((preset) => preset.id === id)?.name ?? null;
  const green = builtInNamed("classic-green");
  const rightDefault =
    (presets.target === green ? builtInNamed("default") : green) ??
    rightChoices[0] ??
    presets.target;
  const rightNamed =
    rightPreset !== null && rightChoices.includes(rightPreset)
      ? rightPreset
      : rightDefault;
  /* And what it holds. Falling back to the main board's own settings leaves
     two boards drawn alike, which says plainly that the choice did not land —
     better than a blank half of the page. */
  const rightSettings = presets.settingsNamed(rightNamed) ?? settings;
  /* The pictures each board draws its men with; the main board's are also the
     bars', the palette's and the title's. */
  const glyphs = glyphSet(settings.pieces.glyphSet);
  const rightGlyphs = glyphSet(rightSettings.pieces.glyphSet);
  /*
    How the GIF would look, for the export tab to tell when an estimate of its
    size has gone stale: both boards' settings, the second only while it is up.
  */
  const gifLook = useMemo(
    () => ({ settings, right: twoBoard ? rightSettings : null }),
    [settings, rightSettings, twoBoard]
  );

  /*
    One colour speaks for a side's rays, though the settings keep one per piece
    kind: their mean. They are the same colour today, and the mean stays honest
    if they are ever parted.
  */
  const rayColors = useMemo(
    () => ({
      mine: meanColor(Object.values(settings.attacks.rays.colors.me)),
      theirs: meanColor(Object.values(settings.attacks.rays.colors.opponent)),
    }),
    [settings.attacks.rays.colors]
  );

  // The board the fields are painted on: a light square, which is what the
  // marks are read against.
  const square = settings.board.squares.lightSquare;

  const rayFieldColor = useCallback(
    (mine: number, opponent: number) =>
      raysOver(
        square,
        rayColors.mine,
        rayColors.theirs,
        mine * settings.attacks.rays.maxOpacity.me,
        opponent * settings.attacks.rays.maxOpacity.opponent
      ),
    [square, rayColors, settings.attacks.rays.maxOpacity]
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
    mine: settings.attacks.rays.maxOpacity.me,
    opponent: settings.attacks.rays.maxOpacity.opponent,
  };
  const heatFull = {
    mine: settings.attacks.heatmap.maxStrength.me,
    opponent: settings.attacks.heatmap.maxStrength.opponent,
  };

  const heatFieldColor = useCallback(
    (mine: number, opponent: number) =>
      heatOver(
        square,
        settings.attacks.heatmap.color.me,
        settings.attacks.heatmap.color.opponent,
        mine * settings.attacks.heatmap.maxStrength.me,
        opponent * settings.attacks.heatmap.maxStrength.opponent
      ),
    [
      square,
      settings.attacks.heatmap.color.me,
      settings.attacks.heatmap.color.opponent,
      settings.attacks.heatmap.maxStrength,
    ]
  );

  /**
   * Moving one or both choosers. Linked, whichever was moved carries the other
   * with it; parted, each keeps its own.
   */
  function setIntensity(moved: { rays?: SideIntensity; heatmap?: SideIntensity }) {
    const linked = settings.attacks.raysAndHeatmapIntensityLinked;
    const next = moved.rays ?? moved.heatmap;
    const rays = linked ? next! : moved.rays ?? settings.attacks.rays.intensity;
    const heat = linked ? next! : moved.heatmap ?? settings.attacks.heatmap.intensity;
    setSettings({
      ...settings,
      attacks: {
        ...settings.attacks,
        rays: { ...settings.attacks.rays, intensity: rays },
        heatmap: { ...settings.attacks.heatmap, intensity: heat },
      },
    });
  }

  /**
   * Whether a side is drawn, and turning it on or off — in both pictures at
   * once, which is what the one switch between the two choosers says.
   *
   * Each picture keeps its own answer, so a file may arrive with them at odds.
   * The switch then shows neither state: it reads as part-drawn, and pressing
   * it turns both on, which is the way out of a state nothing on this panel
   * could have produced.
   */
  function sideShown(side: "Mine" | "Opponent") {
    const rays = settings.attacks.rays[`show${side}`];
    const heatmap = settings.attacks.heatmap[`show${side}`];
    return {
      both: rays && heatmap,
      mixed: rays !== heatmap,
      set: (shown: boolean) =>
        setSettings({
          ...settings,
          attacks: {
            ...settings.attacks,
            rays: { ...settings.attacks.rays, [`show${side}`]: shown },
            heatmap: { ...settings.attacks.heatmap, [`show${side}`]: shown },
          },
        }),
    };
  }

  /** Joining the two, which takes the rays' setting for both, or parting them. */
  function linkIntensity(linked: boolean) {
    const heat = linked
      ? settings.attacks.rays.intensity
      : settings.attacks.heatmap.intensity;
    setSettings({
      ...settings,
      attacks: {
        ...settings.attacks,
        raysAndHeatmapIntensityLinked: linked,
        heatmap: { ...settings.attacks.heatmap, intensity: heat },
      },
    });
  }

  /*
    Which panel the page opens on.

    The board's own tab, unless the address names a game still being played —
    a reload of a tab that was in one, or a link followed back into one. Then it
    opens on the game: that is what the reader came back for, and the panel
    saying whose move it is and who is still connected is there.

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
  const period = settings.lab.playPeriodPerPositionSec;
  /* And how long it waits before the first of them, from the press of Play. */
  const initialDelay = settings.lab.playInitialDelaySec;
  /* The two paces of a game with variations: back to a fork, and the hold at
     the end of a line. */
  const backStep = settings.lab.playBackStepSec;
  const lineEndHold = settings.lab.playLineEndHoldSec;
  /*
    The walk a game playing itself still has to take, and the step it took
    last.

    Worked out when the game is set playing, from wherever the board is and on
    whichever line, and taken a step at a time: on to the end of the line, back
    to where the next line leaves it, over to that line, and on again. A game
    with no variations is one line, and the walk is simply its moves. Kept by
    the timer below rather than by the button, so that every way a game starts
    playing — the button, or a link that asks for it — is walked the same.

    `at` is the board as the walk last left it, and `paused` says the game was
    stopped there: set playing again with the board unmoved, it carries on with
    the same walk rather than working out a new one from the position — which,
    halfway back to a fork, would go forward to the end of the line again.
  */
  const tour = useRef<{
    steps: Step[];
    last: Step | null;
    at: PositionHistory;
    paused: boolean;
  } | null>(null);
  /*
    The longest the fade a landing sets off may take while a game plays itself
    — in the Lab, or into a GIF: how long the board will stand once the move
    being played is down.

    A fade longer than that was still going when the next move set off, and was
    cut off partway, its marks never reaching what they were fading to. The
    back step period is the pace it happened at most: shorter than the fade by
    default, on purpose, since going back is meant to be quick. Fitted to the
    rest instead, a fade always finishes, and the pace is the one that was set.

    Null while the reader steps by hand: their moves come when they come, and
    the fade is the one the settings say.
  */
  const [fadeWithin, setFadeWithin] = useState<number | null>(null);
  /*
    And the fit waiting for the piece in the air to land. Only the fade a
    landing sets off has the next move coming after it; the marks a piece
    takes with it as it lifts fade while it travels — see `fitted` — and, cut
    to the pace of a step back, a mate's disc went in a flicker where it had
    come in slowly. So a move clears the fit as it sets off, and `land` puts
    this one in its place.
  */
  const landingFade = useRef<number | null>(null);
  /*
    How long the board's marks take to change, as they change now.

    While a piece is in the air, whatever it set fading as it lifted — the
    marks it held, the last move's spots going over to the move it is making,
    a mate's disc as the game steps back from it — has the whole of its flight
    to fade in, and takes it. The flight is the move: half a second, where a
    mark gone in the first fifth of it was gone before the eye had followed the
    piece off its square. From the landing on it is the settings' fade, fitted
    into the rest after the move while a game plays itself; see `fadeWithin`.
    None at all where the settings ask for none.
  */
  const fitted = (fadeMs: number) =>
    fadeMs <= 0
      ? 0
      : flight !== null
        ? flight.ms
        : fadeWithin === null
          ? fadeMs
          : Math.min(fadeMs, fadeWithin);
  /* Whether a shared link should set the game playing for whoever opens it. */
  const [pgnOpen, setPgnOpen] = useState(false);
  // Which library game the board is on, so the list can keep naming it, and why
  // one would not load, if ever one does not.
  /*
    A game read in from somewhere else — the library, a file, or a link — and
    who it was between.

    Kept beside the line it arrived as, because the names belong to that line
    and not to the board. Step through it and they stand; play a move of your
    own and the line stops being that game, so they go and the board is nobody's
    but yours. See `readGame` below, which is what the two are compared to.

    A link that carried a game opens as one read in, when its PGN says who
    played or how it ended: it is a game somebody handed over, and it should
    arrive the way it left — named over the board, and written out whole again
    if it is passed on. See `Opening.game` for the links that do not.
  */
  const [read, setRead] = useState<{
    players: { white: string; black: string };
    /** As the file said it: "1-0", "0-1", "1/2-1/2", or nothing. */
    result: string | null;
    /**
     * Every way through the game: the main line, and one more for each
     * variation the file gives. The board holds one of them at a time, and is
     * still this game for as long as it does.
     */
    lines: TreeLine[];
    /**
     * The text it was read from, exactly as it came.
     *
     * Kept so the game can be written out again without being rebuilt: the
     * text carries everything a file can say about a game — the players and
     * the result, and the event, the date, the comments, the variations — and
     * a game rebuilt from its moves keeps only the moves. While the line is
     * the one read, it is the same game, and it goes out as it came in.
     *
     * In the Lab's branched mode, written afresh at every move played: the
     * tree the reader is building, tags and all.
     */
    pgn: string;
    /**
     * Built in the Lab's branched mode from a board that held no game, rather
     * than read in: its tags are this app's own, written again from its main
     * line at every move, since nothing else said them.
     */
    recorded?: boolean;
    /**
     * Changed here: a line played that the game did not have, with variations
     * kept, or the lines before one cleared away. Something on the board that
     * the file it came from does not hold.
     */
    changed?: boolean;
  } | null>(() =>
    opening?.game == null ? null : { ...opening.game, lines: gameLines(opening.game.pgn, history) }
  );
  const [libraryGame, setLibraryGame] = useState<string | null>(null);
  const [libraryGameError, setLibraryGameError] = useState<string | null>(null);
  const [pgnExportOpen, setPgnExportOpen] = useState(false);
  /*
    Games put aside, and the name the one on the board goes by. The name is what
    "Stash it" writes back over; until the game has been given one there is
    nothing to write to, which is what disables that button.

    Read from this browser's store on the way in and written back on every
    change, so a stash outlives the tab it was made in. Another tab of the same
    app writes to the same place, so what is read here may be behind: it is read
    again whenever the list is about to be used or written to. See `stashStore`.
  */
  const [stash, setStash] = useState<GameStash>(() => loadStash());
  const [stashName, setStashName] = useState<string | null>(null);
  const [stashDialogOpen, setStashDialogOpen] = useState(false);

  /**
   * Replaces the history with a whole game, positioned at the last move it
   * reached. Returns why the text was rejected, for the dialog to show without
   * closing.
   */
  function loadPgn(pgn: string): string | null {
    const { entries, players, result, error } = parsePgn(pgn);
    if (entries === null) {
      return error;
    }
    stepAwayForChange();
    const loaded = historyFromLine(entries);
    setHistory(loaded);
    showPosition(currentPosition(loaded));
    /* Read in from somewhere that still has it. */
    handed.current = lineOf(loaded);
    setRead({ players, result, lines: gameLines(pgn, loaded), pgn });
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
      /*
        And the board stops being anybody's game.

        A game off the library is somebody else's, played a century ago; it is
        not the game two people were sitting at. Left attached, the panel went
        on naming that game, the row in the list went on being marked as the
        one in front of the reader, and the two players' names stayed over a
        board neither of them was playing on. The list keeps the game — this is
        putting it down, not giving it up — and a click picks it back up.

        Only ever from here: a game still being played locks the library, so
        what is put down is a game already finished or a challenge still out.
      */
      putBoardDown();
    }
  }

  /**
   * The text a game read in came from — pasted in, picked from the library, or
   * carried by a link — while the board still holds that game unchanged.
   *
   * Worth going back for rather than writing the game out again: the text
   * carries the tags the game is actually known by — who played it, how it
   * ended, where and when — and everything else a file can say, and replaying
   * the moves through chess.js would put a roster of question marks in their
   * place. As soon as a move of one's own is played the line stops being that
   * game, and writing it out is the only honest thing left to do.
   *
   * This used to be asked of the library alone, and a game pasted in was
   * written out from its moves: the names and the result it came with were
   * lost on the way out, while the board went on showing them. It is now asked
   * of `readGame`, the one answer there is to "is this still the game that was
   * read?" — the same answer the names over the board are drawn from, so the
   * two cannot disagree about it.
   */
  function originalPgn(): string | null {
    return readGame?.pgn ?? null;
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

  /**
   * This browser's stash as it stands now, taking in whatever another tab has
   * put aside since this one last looked.
   *
   * Called when the list is about to be read or written to, which is as often
   * as is worth reading a browser store.
   */
  const freshStash = useCallback((): GameStash => {
    const merged = mergeStash(stash, loadStash());
    if (merged.length !== stash.length) {
      setStash(merged);
    }
    return merged;
  }, [stash]);

  /**
   * Puts the game aside under a name, and says why not where it will not.
   *
   * A name this tab knows is its own to write over — that is what stashing
   * again is for, and the dialog has already asked. A name only the store
   * knows belongs to another tab: writing there would throw away a game this
   * tab cannot offer back, so the reader is asked for another name instead.
   */
  function putAside(name: string): string | void {
    const held = freshStash();
    if (strangeNames(stash, held).includes(name)) {
      return `Another tab has stashed a game as \u201c${name}\u201d. Try another name.`;
    }
    /* What exporting it would write, kept with it: a stash and an export are
       one thing, the game as PGN, kept in two places. */
    setStash(saveStash(stashGame(held, name, history, sharablePgn() ?? undefined)));
  }

  /**
   * Throws away everything put aside, in this browser rather than in this tab.
   *
   * The game on the board is left where it is — it is what the reader is
   * looking at — but it stops being a stashed game, so "Stash game" has
   * nothing to write back over until it is given a name again.
   */
  function forgetStashes() {
    clearStash();
    setStash([]);
    setStashName(null);
  }

  /** Puts the game aside under the name it already goes by. */
  function stashHere(name: string): string | void {
    const refused = putAside(name);
    if (refused !== undefined) {
      return refused;
    }
    setStashName(name);
  }

  /**
   * A game taken back out of the stash, restored as it was left — the same
   * line, at the same position in it — and still going by the same name.
   */
  function loadStashedGame(name: string) {
    const game = stashedGame(freshStash(), name);
    if (game === undefined) {
      return;
    }
    stepAwayForChange();
    setHistory(game.history);
    showPosition(currentPosition(game.history));
    handed.current = lineOf(game.history);
    /*
      Read back as a PGN is read in: its lines, its names, its result — every
      line the export held, where it held more than one — with the board on
      the one it was on. A stash from before PGN was kept with it, or one whose
      line its PGN does not hold, comes back as the line alone.
    */
    setRead(null);
    if (game.pgn !== undefined) {
      const kept = parsePgn(game.pgn);
      const tree = readTree(game.pgn);
      const lines = tree === null ? [] : linesOf(tree);
      const stood = lineOf(game.history);
      if (kept.entries !== null && lineIndex(lines, stood.initialFEN, stood.moves) >= 0) {
        setRead({ players: kept.players, result: kept.result, lines, pgn: game.pgn });
      }
    }
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
  /**
   * A game with a friend is left before the board is given another position:
   * the "Step away" the games panel offers, done for the reader, since what is
   * about to be on the board is no longer that game. A game still being played
   * never gets here — the controls that set a position are closed while it is
   * on — so this is a game that is over, or a challenge waiting for an answer:
   * the one stays in the list, and the other stays offered.
   *
   * Not for stepping through the game's moves, which is reading it.
   */
  function stepAwayForChange() {
    if (friend.phase.kind !== "idle") {
      friend.putDown();
    }
  }

  function setPosition(next: string) {
    stepAwayForChange();
    showPosition(next);
    setHistory(startHistory(next));
    /* Typed, pasted or reset: whatever follows from here is the board's own
       and nobody else's copy of it — nor any game's that was read in, whose
       names and lines go with it, as they do at a move of one's own. */
    handed.current = null;
    setRead(null);
    setLibraryGame(null);
    setLibraryGameError(null);
    setStashName(null);
  }

  /**
   * Lets go of every line but the one on the board, and of the moves after
   * where the board stands on it: what is left is the way from the first
   * position to the one on the board, as a line of the reader's own — at the
   * first position, nothing but the position. A game with a friend is not the
   * reader's to cut, and keeps every move it has.
   */
  function clearOtherLines() {
    if (friend.phase.kind === "playing") {
      return;
    }
    setPlaying(false);
    setRead(null);
    setHistory({ entries: history.entries.slice(history.current), current: 0 });
  }

  /**
   * Opens the board editor on the position on the board — its men and whose
   * move it is, castling and en passant left to the FEN field. Every change
   * from here on is a position set outright, as one typed in is, so the rays,
   * the pins and a mate are drawn as it is built, and the FEN field follows
   * it. The palette's Clear goes back to the two kings.
   *
   * A board holding more than the one position — a game, a line, a tree of
   * them — has something to lose, and the reader is asked first whether to
   * stash it; either answer opens the editor on the same position.
   */
  function openEditor() {
    if (shown === null) {
      return;
    }
    setPlaying(false);
    if (boardIsDirty()) {
      setStashingForEditor(true);
      return;
    }
    startEditing();
  }

  /**
   * Whether the board holds something that is nowhere else, and would be lost
   * if it were put aside: moves the reader made, a tree of lines built here,
   * or lines added to a game read in. Not a single position, and not a game as
   * it came — from the library, a file, a link, or the stash — which can be
   * had again from where it came from.
   */
  function boardIsDirty(): boolean {
    if (history.entries.length === 1 && (read === null || read.lines.every((line) => line.moves.length === 0))) {
      return false;
    }
    if (read !== null) {
      return read.recorded === true || read.changed === true;
    }
    const here = lineOf(history);
    return !(
      handed.current !== null &&
      handed.current.initialFEN === here.initialFEN &&
      handed.current.moves.join(" ") === here.moves.join(" ")
    );
  }

  function startEditing() {
    if (shown === null) {
      return;
    }
    setStashingForEditor(false);
    setEditor(true);
    setTool(null);
    setEditorPast([]);
    setEditorFuture([]);
    setPosition(asBoardEditorPosition(shown.fen()) ?? TWO_KINGS);
  }

  /**
   * Closes it, on the position it has built — the start of a game of its own,
   * to play or to record lines from.
   *
   * Both of its Done buttons are closed to a position no game could reach, so
   * that is all it is asked to close on. Should anything else ever close it on
   * one, it closes on the ordinary starting position instead, there being
   * nothing that could be played from the other.
   */
  function closeEditor() {
    const built = shown?.fen() ?? TWO_KINGS;
    setEditor(false);
    setTool(null);
    setEditorPast([]);
    setEditorFuture([]);
    if (boardEditorProblems(built).length > 0) {
      setPosition(DEFAULT_POSITION);
    }
  }

  /**
   * A change made in the editor, where the editor allows it, kept for Undo;
   * `dragged` is a piece carried there by hand, which is not flown.
   */
  function editTo(next: string | null, dragged: Square | null = null) {
    const now = shown?.fen();
    if (next === null || now === undefined || next === now) {
      return;
    }
    if (dragged !== null) {
      draggedTo.current = dragged;
    }
    setEditorPast([...editorPast, now]);
    setEditorFuture([]);
    setPosition(next);
  }

  /** The editor's last change taken back, and kept for Redo. */
  function undoEdit() {
    const now = shown?.fen();
    const back = editorPast[editorPast.length - 1];
    if (back === undefined || now === undefined) {
      return;
    }
    setEditorPast(editorPast.slice(0, -1));
    setEditorFuture([now, ...editorFuture]);
    setPosition(back);
  }

  /** And made again. */
  function redoEdit() {
    const now = shown?.fen();
    const on = editorFuture[0];
    if (on === undefined || now === undefined) {
      return;
    }
    setEditorFuture(editorFuture.slice(1));
    setEditorPast([...editorPast, now]);
    setPosition(on);
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

  /*
    Where along the walk through every line the board last stood when it was
    stepped there with Shift and an arrow: a position the walk passes twice —
    going out along a line, and coming back to a fork — is told apart by it.
  */
  const touring = useRef(-1);

  /**
   * One position on or back along the walk through every line — the walk Play
   * takes: Shift and → plays the next move of it, which at the end of a line
   * is the first step back to where the next line leaves, and Shift and ←
   * takes the one before. By hand, at the reader's pace, with nothing else of
   * Play's: no rests, and a move at a time.
   */
  function stepTour(back: boolean) {
    setPlaying(false);
    const places = tourPlaces(walkLines);
    const at = tourIndex(walkLines, places, walkLine, history.entries.length - 1 - history.current, touring.current);
    const to = places[at + (back ? -1 : 1)];
    if (at < 0 || to === undefined) {
      return;
    }
    touring.current = at + (back ? -1 : 1);
    if (to.line !== walkLine) {
      switchLine(to.line, to.depth);
      return;
    }
    showHistory({ ...history, current: history.entries.length - 1 - to.depth });
  }

  function stepHistory(direction: "first" | "previous" | "next" | "last") {
    /* A hand on the controls takes the game back off the clock: whoever is
       stepping through it themselves has stopped watching it play. */
    setPlaying(false);
    /*
      The first position of a game with variations is its first line's: back
      to the start, and over to the main line, whichever line the board was
      on — so that Play from there walks every line, the first first, which is
      what going back to the beginning is nearly always for. Stepping back one
      position at a time stays on the line the board is on: that is reading
      the line, and its first position is where it stops.
    */
    if (direction === "first" && readGame !== null && readGame.lines.length > 1) {
      switchLine(0, 0);
      return;
    }
    /* And the last, the end of its last line: where Play would stop, having
       walked them all. */
    if (direction === "last" && readGame !== null && readGame.lines.length > 1) {
      const last = readGame.lines.length - 1;
      switchLine(last, readGame.lines[last].moves.length);
      return;
    }
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

  /**
   * Puts another of the game's lines on the board, at `depth` moves from the
   * start — the fork where it parts from the line that was there, or before
   * it — so that nothing on the board moves, and the next move played is the
   * new line's.
   */
  function switchLine(index: number, depth: number): PositionHistory | null {
    const line = read?.lines[index];
    if (line === undefined) {
      return null;
    }
    const moved: PositionHistory = {
      entries: line.entries,
      current: Math.max(0, line.entries.length - 1 - depth),
    };
    /* Handed over by the game itself: nothing of the reader's is on the board. */
    handed.current = lineOf(moved);
    showHistory(moved);
    return moved;
  }

  /*
    The board as the GIF export drives it: the walk through the game, a move on
    or back as the board plays one, and another of the game's lines taken up at
    a fork.

    Each is committed before it returns — `flushSync` — so the export finds the
    board already moved, and the flight already set off, the moment it asks.
    The export runs across many turns of the event loop and a render happens
    between most of them, so what it calls is read from the latest render
    rather than from the one it was made in.
  */
  const latest = useRef({ history, read, showHistory, switchLine });
  latest.current = { history, read, showHistory, switchLine };
  const gifDriver = useMemo<GifDriver>(() => {
    /* The lines to walk: the game's own, while the board holds one of them,
       and otherwise the one line the board has. */
    const linesNow = (): TreeLine[] => {
      const { history: now, read: game } = latest.current;
      const here = lineOf(now);
      const index = game === null ? -1 : lineIndex(game.lines, here.initialFEN, here.moves);
      return index >= 0 && game !== null
        ? game.lines
        : [soleLine(now.entries, here.moves)];
    };
    return {
      begin: () => {
        const was = latest.current.history;
        const handedWas = handed.current;
        const first = linesNow()[0];
        flushSync(() => {
          setPlaying(false);
          landingFade.current = null;
          setFadeWithin(null);
          const start: PositionHistory = { entries: first.entries, current: first.entries.length - 1 };
          handed.current = lineOf(start);
          latest.current.showHistory(start);
        });
        /* And back: the line the reader was on, where they were on it, and
           whatever the board thought of it as — theirs, or handed to it. */
        return () =>
          flushSync(() => {
            landingFade.current = null;
            setFadeWithin(null);
            handed.current = handedWas;
            latest.current.showHistory(was);
          });
      },
      steps: () => walk(linesNow(), 0, 0),
      forward: (restMs) => {
        flushSync(() => {
          landingFade.current = restMs;
          setFadeWithin(null);
          latest.current.showHistory(goNext(latest.current.history));
        });
      },
      back: (restMs) => {
        flushSync(() => {
          landingFade.current = restMs;
          setFadeWithin(null);
          latest.current.showHistory(goPrevious(latest.current.history));
        });
      },
      switchTo: (line) => {
        flushSync(() => {
          const now = latest.current.history;
          latest.current.switchLine(line, now.entries.length - 1 - now.current);
        });
      },
    };
  }, []);

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
      settings.pieces.moveMotion.speed <= 0 ||
      reducedMotion()
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
        squaresApart(piece.from, piece.to, side)
      )
    );
    /*
      A step back in a game playing itself, or in the frames of one being
      exported, is the way to the next line rather than a move to watch, and
      goes that much faster: the time it is given divided by the Lab's factor,
      and the speed it is given multiplied. Stepping back by hand is reading
      the move again, at its own pace.
    */
    const quicker = backward !== null && (playing || exporting) ? Math.max(settings.lab.playBackStepSpeedup, 0.1) : 1;
    const motion = {
      ...settings.pieces.moveMotion,
      speed: settings.pieces.moveMotion.speed * quicker,
      time: settings.pieces.moveMotion.time / quicker,
    };
    const ms = flightTime(squares, moveSpeed(motion, squares));
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
    if (flight === null || exportingRef.current) {
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
    setFadeWithin(landingFade.current);
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

    Going from one game to another passes through the moment of being at
    neither, and reading that moment honestly — no game, so no names — took the
    two rows away, let the board grow into the space, and put them back a
    fraction of a second later: the board jumping out and back at every switch.

    So while a game is on its way, the answer is whatever it last was. Between
    two games that both name their players, the rows stay and hold their space;
    between two challenges, which name nobody, they stay away. Either way the
    board is one size for the whole switch, and changes at most once — when the
    new game arrives and turns out to be a different kind of thing from the old
    one.
  */
  /*
    A game read in, while the board still holds it as it was read — or holds
    another of its lines, which is the same game read a different way.

    Stepping about in it keeps the names — that is reading the game. Playing a
    move of one's own does not: the line stops being that game at the first
    move that was not in it, so the names go and the board is the reader's own
    again. The comparison is the line, not the position, so walking back to the
    start and forward again is not a change.
  */
  const here = lineOf(history);
  /* Which of the game's lines the board holds — any of them is the game. */
  const onLine = read === null ? -1 : lineIndex(read.lines, here.initialFEN, here.moves);
  const readGame = onLine >= 0 ? read : null;
  /*
    The lines the board can walk, and what is left of the walk from where it
    stands: every line of a game read in, while the board holds one of them,
    and otherwise the one line the board has. Nothing left is nothing to play.
  */
  const walkLines: TreeLine[] =
    readGame !== null ? readGame.lines : [soleLine(history.entries, here.moves)];
  const walkLine = readGame !== null ? onLine : 0;
  const still = walk(walkLines, walkLine, history.entries.length - 1 - history.current);
  /*
    Which way a game with variations has gone, to be said over the board: the
    line it is on, counted among the rest, and its choice at each fork the
    board has come to. Nothing before the first fork, where it is every line at
    once — and nothing at all for a game that only goes one way.
  */
  const branch =
    readGame !== null && readGame.lines.length > 1
      ? {
          number: onLine + 1,
          of: readGame.lines.length,
          path: pathSoFar(readGame.lines[onLine], history.entries.length - 1 - history.current),
        }
      : null;
  /*
    And how it came out, which a game with variations says line by line: each
    line's own ending goes up with its name, and changes when the name does.
  */
  const readResult =
    readGame === null
      ? null
      : resultShown(readGame.lines, onLine, history.entries.length - 1 - history.current, readGame.result);
  /* Whether "First position" has anywhere to go: back along the line, or —
     at the start of any line of a game with variations but the first — over
     to the first line. See `stepHistory`. */
  const canGoFirst = canGoPrevious(history) || (branch !== null && onLine !== 0);
  /* And "Last position": on along the line, or — anywhere but the last line —
     over to the end of the last. */
  const canGoLast = canGoNext(history) || (readGame !== null && readGame.lines.length > 1 && onLine !== readGame.lines.length - 1);

  /*
    Standing somewhere earlier in a game that is still being played.

    Nothing can be played from here — the board is frozen off the head, since a
    move from an earlier position would fork a game that is not this browser's
    to fork — so the side whose move it is gets an empty flower and a note
    saying which position of the game is on the screen. Both go when the reader
    comes back to the last move, and the move can be made again.
  */
  const steppedBack =
    friend.phase.kind === "playing" && history.current !== 0;
  const playedSoFar = history.entries.length - 1;
  const lookingAt = playedSoFar - history.current;

  /*
    How a game came out, said from nobody's side.

    The panel tells the player what happened to them — "You lost by
    resignation" — because that is what somebody reading their own list wants.
    Over the board, where both names are up, the neutral scoreline is the
    honest form: it is a fact about the game rather than about either of them.
  */
  /*
    What the board is showing, said along the row above it.

    Only where there is a game to say it about: a position of one's own has no
    result and no place in a line, and a row of facts about nothing would be
    worse than the space it takes.
  */
  /* Spaced either side of the colon, as a scoreline is written: "1 : 0" reads
     as two numbers with a result between them, where "1:0" reads as a time. */
  /*
    Where the board is standing in whatever line it holds, said the same way
    wherever it stands.

    "Half-move 47 of 47" at the end rather than "47 half-moves": one form means
    the reader never has to work out which of two things they are being told,
    and the number they are looking for — where am I in this game — is in the
    same place every time. A line with nothing in it says nothing at all.
  */
  const counted =
    playedSoFar === 0 ? "" : `half-move ${lookingAt} of ${playedSoFar}`;

  const scoreOf = (result: string) =>
    result === "1-0" ? "1 : 0" : result === "0-1" ? "0 : 1" : "½ : ½";

  /*
    Whether the game read in says who played it — either of them. A file that
    names nobody is a task or an exercise, and its players are only the colours
    they have; the board says those already, and two rows of "White" and
    "Black" with flowers beside them would take height from it to say nothing.
    Such a game is shown as a board of one's own is, whatever is done on it,
    so nothing over it changes shape as its lines are walked or left.
  */
  const namesKnown =
    readGame !== null &&
    (readGame.players.white !== UNNAMED.white || readGame.players.black !== UNNAMED.black);
  const namesShown = useRef(false);
  const atOne =
    friend.phase.kind === "playing" ||
    friend.phase.kind === "waiting" ||
    (friend.phase.kind === "idle" && namesKnown);
  if (friend.phase.kind !== "opening") {
    namesShown.current = atOne;
  }
  const atAGame = friend.phase.kind === "opening" ? namesShown.current : atOne;
  /*
    Who is at each end.

    A challenge has one player and a chair: the opponent is named for the shape
    of the thing rather than because anybody knows who they are, and the board
    reads as a game waiting for somebody instead of as a position that happens
    to be up. Where the side is still the opponent's to pick, this end is drawn
    as the near one — it is where the reader's own name goes, and the game will
    turn the board round itself the moment it starts.
  */
  const named: { names: Record<Color, string>; mine: Color | null } | null =
    friend.phase.kind === "playing"
      ? {
          names: {
            [friend.phase.you]: friend.name,
            [friend.phase.you === "w" ? "b" : "w"]: friend.phase.opponent,
          } as Record<Color, string>,
          mine: friend.phase.you,
        }
      : friend.phase.kind === "waiting"
        ? (() => {
            const yours =
              friend.phase.you === OPPONENT_CHOOSES
                ? side === "black"
                  ? "b"
                  : "w"
                : friend.phase.you;
            return {
              names: {
                [yours]: friend.name,
                [yours === "w" ? "b" : "w"]: "An opponent",
              } as Record<Color, string>,
              mine: yours as Color,
            };
          })()
        : readGame !== null
          ? {
              /* A game somebody else played: two names and no chair of your
                 own, which is what makes the board a thing to read rather than
                 a thing to sit at. */
              names: { w: readGame.players.white, b: readGame.players.black },
              mine: null,
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

    Not a game that is over, though. There is nothing to come back to play, so
    the position the reader left the board at is the one they meant to be
    looking at — and taking them to the last move of a game that ended a week
    ago is undoing what they just did. The lock in the title says why no move
    can be made from where they are standing.

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
      if (history.current !== 0 && friend.phase.over === null) {
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
    // and whether it is over, which decides whether the board is caught up.
  }, [
    tab,
    friend.phase.kind,
    friend.phase.kind === "playing" ? friend.phase.over : null,
    history,
    stashName,
  ]);

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

  /*
    Nothing is put up on arriving at this tab.

    The list used to open at the game last touched, on the grounds that an empty
    panel over a full list is the app declining to answer a question it can
    answer. It answers a different question badly, though: a reader who has been
    working on the other tab and steps over here to look at the list is handed a
    game, and being handed one means being asked what to do with what they were
    working on — a question they did not ask for, about work they had not
    finished. The panel says to pick a game instead, and picking one is a click.
  */
  const putBoardDown = useCallback(() => {
    if (friend.phase.kind === "idle") {
      return;
    }
    friend.putDown();
  }, [friend]);

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
    One position at a time, each left standing for its period.

    The timer is set again on every change of position, which is what makes the
    game walk: each step changes `history`, this runs again, and the next step
    is booked. The steps are the walk through every line of the game — see
    `walk` — and it ends itself at the end of the last one: there is nothing
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
      /*
        Stopped: the walk is kept for Play to take up again, and the fades go
        back to the settings' own — once, as it stops. This runs again on every
        change of position while stopped, and a GIF being made changes it with
        every move, its fades fitted by the export; clearing them each time
        undid the fit before the piece had landed.
      */
      if (tour.current !== null && !tour.current.paused) {
        tour.current.paused = true;
        landingFade.current = null;
        setFadeWithin(null);
      }
      return;
    }
    /* Still travelling: the clock has not started. It starts when the board
       says the piece is down, which clears this and runs it again. */
    if (flight !== null) {
      return;
    }
    /*
      Worked out afresh from wherever the board is when there is no walk to
      carry on with — the first Play, or the board moved since the walk left
      it: by hand while stopped, or by something else while playing, a move
      arriving in a game being played or another game loaded — so no step
      meant for one line is ever taken on another. A walk that was going when
      that happened keeps its pace; it is only the first step after Play that
      waits the initial delay.
    */
    const kept = tour.current;
    const walking =
      kept === null || kept.at !== history
        ? {
            steps: still,
            last: kept !== null && !kept.paused ? kept.last : null,
            at: history,
            paused: false,
          }
        : kept;
    if (walking.paused) {
      walking.paused = false;
      walking.last = null;
    }
    tour.current = walking;
    const step = walking.steps[0];
    if (step === undefined) {
      setPlaying(false);
      return;
    }
    /*
      How long the board stands before the step: the initial delay before the
      first, and after that the pace of what comes next — the period before a
      move on, the hold at the end of a line before turning back, the back-step
      period on the way to the fork. Taking up the next line at the fork moves
      nothing, and is done the moment the board gets there: the new line's name
      goes up while the fork is on the board, and the period that follows is
      the time there is to read it.

      The first step is the first taken since the game was set playing — counted,
      not recognised by its position. A game with variations comes back to its
      forks, and a fork at the very start of the game would otherwise have its
      first position mistaken for where the playing began, and be held for the
      initial delay every time the walk came back to it.
    */
    const paceBefore = (next: Step, before: Step): number =>
      next.kind === "switch"
        ? 0
        : next.kind === "back"
          ? before.kind === "forward"
            ? Math.max(lineEndHold, 0)
            : Math.max(backStep, 0)
          : Math.max(period, 0.1);
    const last = walking.last;
    const wait = last === null ? Math.max(initialDelay, 0) : paceBefore(step, last);
    /* Cleared by the cleanup below whenever the game stops or the board
       changes, so the walk it fires on is always the one it was booked for. */
    const next = window.setTimeout(() => {
      walking.steps.shift();
      walking.last = step;
      /* How long the board will stand once this move is down — to the next
         move, over the fork if the next line is taken up there, and not at all
         at the end — which is as long as its fades may take. */
      if (step.kind !== "switch") {
        let before: Step = step;
        let rest: number | null = null;
        for (const next of walking.steps) {
          if (next.kind !== "switch") {
            rest = paceBefore(next, before);
            break;
          }
          before = next;
        }
        landingFade.current = rest === null ? null : rest * 1000;
        setFadeWithin(null);
      }
      const moved =
        step.kind === "forward"
          ? goNext(history)
          : step.kind === "back"
            ? goPrevious(history)
            : switchLine(step.line, history.entries.length - 1 - history.current);
      /* A step that goes nowhere books no timer after it, and the game would
         sit there playing nothing; it is stopped instead. The walk and the
         lines come from the same render, so it is not expected to happen. */
      if (moved === null || moved === history) {
        setPlaying(false);
        return;
      }
      walking.at = moved;
      if (step.kind !== "switch") {
        showHistory(moved);
      }
    }, wait * 1000);
    return () => window.clearTimeout(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `showHistory`
    // and `switchLine` only set state; taking them as dependencies would book a
    // fresh timer on every render and the game would never reach the end of a
    // period.
  }, [playing, history, period, initialDelay, backStep, lineEndHold, flight]);

  /*
    The Lab's keys: Space plays and holds, the arrows step, and with Ctrl they
    run to either end.

    Live only while the Lab tab is the one open and there is a line on the
    board to walk. A board with no moves behind it has nothing for them to do,
    and leaves the keys to the page. While they are live they are the Lab's
    even where the step they ask for is not there to take: Space at the end of
    a game plays nothing, rather than scrolling a page somebody is filming —
    which in two board mode, with the boards filling the window and the panel
    under them, is what Space would otherwise do.

    Each key does what its button does, through the same function, so a key
    and a click cannot come to mean different things: a step taken by hand
    stops a game that is playing, and Space does nothing at the last position
    for the reason the button is closed there.

    Not taken from anything that already has a use for them. The keyboard may
    be on something — see `keyboardIsOn` — and then the key is that thing's; a
    control may have answered the key itself, as the tab strip does, and then
    it has had it; a dialog, while one is open, has the whole keyboard; and a
    key pressed with Alt or the command key is somebody else's shortcut:
    Alt+← is the browser's Back. Shift and an arrow is this page's own, and
    walks every line of a game with variations, as Play does — see
    `stepTour`; Shift with anything else is left alone.
  */
  /*
    A dialog closed hands the keyboard back to the page, not to the button that
    opened it.

    The browser puts the focus back on that button as a dialog closes, and a
    dialog closed from the keyboard — Escape, or Enter on its last button —
    leaves a button the keyboard is on, which the arrows and Space are then
    that button's rather than the game's: the reader had to click somewhere
    before the arrows stepped through the game again. Taken off it as soon as
    the browser has put it there, the next key is the game's. A reader working
    the page by Tab starts again from the top of it, which is the price.
  */
  useEffect(() => {
    const handBack = (event: Event) => {
      if (!(event.target instanceof HTMLDialogElement)) {
        return;
      }
      /* After the browser has put the focus back, which it does as the dialog
         closes. */
      setTimeout(() => {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && focused !== document.body && focused.closest("dialog[open]") === null) {
          focused.blur();
        }
      }, 0);
    };
    /* `close` does not bubble, but it is seen on its way down. */
    document.addEventListener("close", handBack, true);
    return () => document.removeEventListener("close", handBack, true);
  }, []);

  useEffect(() => {
    if (tab !== "game" || history.entries.length < 2) {
      return;
    }
    const listen = (event: KeyboardEvent) => {
      const { key } = event;
      if (key !== " " && key !== "ArrowLeft" && key !== "ArrowRight") {
        return;
      }
      if (event.defaultPrevented || event.isComposing) {
        return;
      }
      if (event.altKey || event.metaKey) {
        return;
      }
      /* Shift and an arrow walks every line, as Play does; Shift alone with
         anything else is somebody else's. */
      if (event.shiftKey && (key === " " || event.ctrlKey)) {
        return;
      }
      if (key === " " && event.ctrlKey) {
        return;
      }
      if (document.querySelector("dialog[open]") !== null) {
        return;
      }
      if (keyboardIsOn(event.target)) {
        return;
      }
      event.preventDefault();
      if (key === " ") {
        /* Held down, Space would repeat, and a game that starts and stops
           thirty times a second is not what anybody holding it meant. */
        if (!event.repeat && (playing || still.length > 0)) {
          playOrStop();
        }
        return;
      }
      const back = key === "ArrowLeft";
      if (event.shiftKey) {
        stepTour(back);
        return;
      }
      if (back ? !(event.ctrlKey ? canGoFirst : canGoPrevious(history)) : !(event.ctrlKey ? canGoLast : canGoNext(history))) {
        return;
      }
      stepHistory(
        event.ctrlKey
          ? back ? "first" : "last"
          : back ? "previous" : "next"
      );
    };
    window.addEventListener("keydown", listen);
    return () => window.removeEventListener("keydown", listen);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `stepHistory`
    // and `playOrStop` are made afresh every render from exactly these four —
    // the game read in says where "first" is; listening again whenever one of
    // those changes is listening to them.
  }, [tab, history, playing, read]);

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
  const nearSide: Color = side === "black" ? "b" : "w";
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

  /*
    Sitting down at a game turns the board round to the side being played.

    A challenge counts, not only a game under way: somebody who asked to play
    Black is going to play Black, and looking at their own challenge from over
    the White pieces is looking at it from the wrong chair. Where the side is
    still the opponent's to pick there is no chair to take yet, and the board is
    left as it is until somebody answers and the game says which way round it
    goes.

    Where the side is still the opponent's to pick, the board is set to Black by
    convention. Somebody has to be at the bottom of it and there is nothing yet
    to say who; Black is the guess that costs least, since the challenger who
    minded which side they were on would have said so. If the answer turns out
    to be the other way, the game says so on acceptance and the board turns
    then.

    Once per game, and then once more when the game settles what a challenge
    left open: the challenge and the game it becomes are one seat, so the board
    is not spun under a reader who is already at it, but a guess is not allowed
    to outlive the answer to it.
  */
  const seated = useRef<{ seat: string; settled: boolean } | null>(null);
  useEffect(() => {
    const phase = friend.phase;
    if (phase.kind !== "playing" && phase.kind !== "waiting") {
      return;
    }
    const settled = phase.kind === "playing";
    const seatSide = phase.you === OPPONENT_CHOOSES ? "b" : phase.you;
    /*
      By the seat and not by the game. One browser can hold both ends of one
      board — two tabs, two tokens, one game id — and going from one of them to
      the other is sitting down in the opposite chair. Keyed by the game, that
      move was taken for staying where one was, and the board stayed round the
      wrong way while the panel said whose side it was.
    */
    const chair = friend.showingSeat ?? phase.gameId;
    const at = seated.current;
    if (at !== null && at.seat === chair && (at.settled || !settled)) {
      return;
    }
    seated.current = { seat: chair, settled };
    turnBoard(seatSide === "b" ? "black" : "white");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `turnBoard` is
    // made once and never changes; the phase is what this watches.
  }, [friend.phase]);

  // On the document root rather than a wrapper: the frame colour has to reach
  // the whole viewport, and this component only owns part of it.
  useEffect(() => {
    document.documentElement.dataset.theme = settings.board.theme;
    // Read only from inside the dark theme's own block, so publishing it under
    // the light theme is inert rather than something to guard against.
    document.documentElement.style.setProperty(
      "--dark-theme-fg",
      settings.board.darkThemeTextColor,
    );
  }, [settings.board.theme, settings.board.darkThemeTextColor]);

  // A FEN is unparseable for most of the time it takes to type one, so the
  // board keeps showing the last position that did parse rather than blanking.
  const lastValid = useRef(position);
  if (position !== null) {
    lastValid.current = position;
  }
  const shown = position ?? lastValid.current;
  /*
    Which of a game's lines is on the board, said the same way over a board
    with names and over one without — in the middle of the names' row, and at
    the start of the row that stands in for it.
  */
  const branchLabel =
    branch !== null && branch.path.length > 0 ? (
      <span className="branch-path">
        <span className="branch-count">
          Line {branch.number} of {branch.of}:
        </span>{" "}
        {branch.path.join(" › ")}
      </span>
    ) : null;
  /*
    And how the line on a board without names comes out: the file's word for
    it, while the board holds one of the file's lines, and otherwise the
    board's own, for a line the reader has played to a mate or a stalemate.
  */
  const unnamedResult =
    readGame !== null ? readResult : shown === null ? null : resultOnBoard(shown);

  /* Whether there are lines before the one on the board for "Clear lines
     before current" to let go of. */
  const canClearLines = !editor && friend.phase.kind !== "playing" && readGame !== null && onLine > 0;

  /*
    What the boards do while the editor is open: a piece dragged goes anywhere,
    or off the board; a press on a square with something chosen in the palette
    puts it there, or takes away what is there. The board editor's own rules —
    a king is never taken off or covered, a pawn never stands on the first or
    last rank — are `boardEditor.ts`'s, and a change they forbid is not made.
  */
  const editedFen = shown?.fen() ?? TWO_KINGS;
  const editing =
    !editor
      ? undefined
      : {
          onShift: (from: Square, to: Square | null) => editTo(shift(editedFen, from, to), to),
          onPlace: (square: Square) => {
            if (tool !== null) {
              editTo(place(editedFen, square, tool === "erase" ? null : tool));
            }
          },
          placing: tool !== null,
          onLetGo: () => setTool(null),
        };

  /* Undo and Redo from the keyboard as well, by the keys every editor uses for
     them — except where a field has the keyboard, which has its own. */
  useEffect(() => {
    if (!editor) {
      return;
    }
    const keys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) {
        return;
      }
      if (keyboardIsOn(event.target) || document.querySelector("dialog[open]") !== null) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undoEdit();
      } else if (key === "y" || (key === "z" && event.shiftKey)) {
        event.preventDefault();
        redoEdit();
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  });

  /* The editor closes when a game arrives on the board — read in, taken from
     the library or the stash, or begun with a friend: what is on the board is
     no longer a position being set up. */
  useEffect(() => {
    if (editor && (history.entries.length > 1 || friend.phase.kind === "playing" || friend.phase.kind === "waiting")) {
      setEditor(false);
      setTool(null);
    }
  }, [editor, history, friend.phase.kind]);

  /* A question about a promotion goes with the position it was asked in: the
     board moving on — a step, a game arriving — takes it away for good. */
  useEffect(() => {
    if (promoting !== null && shown?.fen() !== promoting.fen) {
      setPromoting(null);
    }
  }, [shown, promoting]);

  /** Moves come back from the board as squares; the position that follows is
   *  a new FEN, so editing by hand and playing by hand feed the same state. */
  function handleMove(from: Square, to: Square, dragged = false, promotion?: PromotionPiece, board = 0) {
    if (shown === null) {
      return;
    }
    /*
      A pawn reaching the last rank waits to be told what it becomes. The move
      is played once that is answered — and flown, dragged or not: while the
      question was open the pawn went back to its square, and it is from there
      that the reader sees it go.
    */
    if (promotion === undefined && isPromotion(shown, from, to)) {
      setPromoting({ from, to, color: shown.turn(), fen: shown.fen(), board });
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
    const next = applyMove(shown, from, to, promotion);
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
    /*
      A move of the reader's own leaves a game read in behind, whatever move it
      is: the board is theirs from here, without the game's names, its lines or
      its result. Even a move the file has too, and even one that goes on to
      finish one of its lines — the game's names coming back at a mate the
      reader played by hand said the board was that game again, when it was the
      reader's own line all along.
    */
    if (treeMode && playInTree(next.fen, next.san)) {
      return;
    }
    setRead(null);
    playPosition(next.fen, next.san);
  }

  /**
   * A move played in the Lab's branched mode, into the tree the board holds:
   * the game read in, or — where the board holds none — the line on it, from
   * its first position to its last, which becomes the tree's main line.
   *
   * A move the tree already makes from here is followed rather than added: on
   * along the line the board is on, if that is the way it goes, and otherwise
   * along the first line that does. Any other is a new branch, put after the
   * ones already leaving this position, and the board is taken onto it. Either
   * way the game stays one game: its names, where it has them, stay over the
   * board, and the whole tree is what exporting it writes.
   *
   * False where the board is somewhere the tree does not go, which it should
   * never be, and the move is then played as it would be out of the mode.
   */
  /**
   * A tree of moves written out as a game: a game read in keeps the tags it
   * came with, and its result; a tree begun here has its tags written from its
   * main line, as a line of its own would be exported, and the result they say.
   */
  function gameOfTree(
    tree: MoveTree,
    lines: TreeLine[],
    from: { pgn: string; result: string | null } | null
  ): { pgn: string; result: string | null } {
    const tags =
      from === null
        ? (toPgn({ entries: lines[0].entries, current: 0 }, stashName, null, null) ?? "")
            .split("\n")
            .filter((row) => row.startsWith("["))
            .join("\n")
        : (from.pgn.match(/\[\s*\w+\s+"(?:[^"\\]|\\.)*"\s*\]/g) ?? []).join("\n");
    const said = /\[\s*Result\s+"([^"]*)"\s*\]/.exec(tags)?.[1] ?? "*";
    return {
      pgn: `${tags}\n\n${writeMovetext(tree)} ${said}\n`,
      result: from === null ? (said === "*" ? null : said) : from.result,
    };
  }

  /**
   * Lets go of every line played before the one on the board — in the order
   * the lines are played, the order Play walks them — and keeps that line and
   * every line after it, each as the game had it. The line on the board is
   * the game's main line after it, and the board stays where it stands.
   */
  function clearLinesBefore() {
    if (readGame === null || onLine <= 0 || friend.phase.kind === "playing") {
      return;
    }
    const tree = readTree(readGame.pgn);
    if (tree === null) {
      return;
    }
    withoutLinesBefore(tree, readGame.lines, onLine);
    const lines = linesOf(tree);
    const { pgn, result } = gameOfTree(tree, lines, readGame.recorded === true ? null : readGame);
    setPlaying(false);
    setRead({ ...readGame, lines, pgn, result, changed: true });
  }

  function playInTree(fen: string, move: string): boolean {
    const depth = history.entries.length - 1 - history.current;
    const path = here.moves.slice(0, depth);
    const tree: MoveTree | null = readGame !== null ? readTree(readGame.pgn) : lineTree(history.entries);
    const played = tree === null ? null : playInto(tree, path, move, fen);
    if (tree === null || played === null) {
      return false;
    }
    const lines = linesOf(tree);
    const wanted = [...path, move];
    const staying = onLine >= 0 && here.moves[depth] === move;
    const index = staying
      ? onLine
      : lines.findIndex((line) => wanted.every((step, at) => line.moves[at] === step));
    if (index < 0) {
      return false;
    }
    const recorded = readGame === null || readGame.recorded === true;
    const { pgn, result } = gameOfTree(tree, lines, recorded ? null : readGame);
    setRead({
      players: readGame?.players ?? { white: UNNAMED.white, black: UNNAMED.black },
      result,
      lines,
      pgn,
      recorded,
      changed: readGame?.changed === true || played.grown,
    });
    const line = lines[index];
    setHistory({ entries: line.entries, current: line.moves.length - wanted.length });
    showPosition(fen);
    return true;
  }

  /*
    Who may move on the boards, and when none may — said once, for both
    boards, which take moves by the same rules.

    Stepping back through a game is reading it. Playing on from an earlier
    position would be starting a different game, and the one being played is
    not this browser's to fork.

    A challenge is frozen outright: there is no game to move in until somebody
    answers it, and a board that took moves would be offering to play against
    nobody. Stepping away is what hands the position back to the reader.
  */
  const playable = friend.phase.kind === "playing" ? friend.phase.you : null;
  const frozen =
    friend.phase.kind === "waiting" ||
    (friend.phase.kind === "playing" &&
      (history.current !== 0 || !friend.link.mine));

  return (
    <main
      className={[
        "app",
        atAGame ? "app-playing" : "",
        /* Two boards take the width the panel had, so the panel goes under
           them and the page grows a scroller. The shape of the page is
           decided here, in one class, rather than in each part of it. */
        twoBoard ? "app-two-up" : "",
      ]
        .filter((name) => name !== "")
        .join(" ")}
    >
      <header className="app-header">
        <h1>
          {/* The app's own queen, in the title's own colour. Hidden from a
              screen reader: it is livery rather than a word, and read out it
              would make the page announce itself as "black chess queen Chess
              Visualizer". */}
          <PieceGlyph set={glyphs} type="q" color="b" side="me" className="title-piece" />
          Chess Visualizer
        </h1>
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
        {/* Left: the board and the bars of men beside it, as tall as the
            window allows. How many bars are up is published here rather than
            read off the two switches in the stylesheet: the width they take is
            wanted by this pane — which is their parent, and so cannot see a
            property set further down — and by the player names inside it. One
            number, set where both can reach it. */}
        <section
          className="board-pane"
          inert={exporting}
          style={
            {
              /* The editor's palette stands in for the bars, one bar wide,
                 whichever of them are up — and a bar a little wider than the
                 men in it, these being taken hold of rather than counted. */
              "--men-bars": String(
                editor
                  ? 1
                  : (settings.pieces.showCaptured ? 1 : 0) + (settings.pieces.showAvailable ? 1 : 0)
              ),
              ...(editor ? { "--men-bar-width": "2.3rem" } : {}),
            } as CSSProperties
          }
        >
          {shown !== null && (
            <div className="board-and-players">
              {/*
                Where the board stands, for a board that is nobody's game — one
                of the reader's own, or a game whose file names nobody: which
                of its lines is up, how that comes out, and how far along it
                the board is.

                Over the board and in the same places along the row as they are
                in a game, so the reader looks in one place for each either
                way. Always there on a board without names, empty or not, so
                that the board does not change size at the first move; see
                `.board-counter`.
              */}
              {!atAGame && (
                <p className="player-name board-counter">
                  {/* Where a name would be, as there is none: which line of
                      the game is up, from where the first file begins. */}
                  <span className="player-who">{branchLabel}</span>
                  <span className={`player-result${editor ? " board-editor-row" : ""}`}>
                    {/* In the editor, whose move it is — pressed to give it to
                        the other side — whether a game could reach the
                        position, in the middle, and the way out of the editor
                        on the far side, as the button after the FEN field is:
                        here only for a position a game could reach, since
                        leaving on any other puts the starting position back
                        and throws the work away. The position being built has
                        no result to show. */}
                    {editor ? (
                      <>
                        <EditorTurn turn={turnOf(editedFen)} onTurn={() => editTo(withTurn(editedFen))} />
                        <EditorSignal problems={boardEditorProblems(editedFen)} warnings={boardEditorWarnings(editedFen)} />
                        <button
                          type="button"
                          className="reset-button board-editor-done"
                          disabled={boardEditorProblems(editedFen).length > 0}
                          title={
                            boardEditorProblems(editedFen).length > 0
                              ? "No game could reach this position yet: see the red cross."
                              : "Finish setting up, and start from this position"
                          }
                          onClick={closeEditor}
                        >
                          Done editing
                        </button>
                      </>
                    ) : (
                      unnamedResult !== null && <span className="player-score">{scoreOf(unnamedResult)}</span>
                    )}
                  </span>
                  <span className="player-position">{counted}</span>
                </p>
              )}
              {/* Whoever is at the far end of the board as it now stands. */}
              {atAGame && (
                <PlayerName
                  name={named?.names[farSide] ?? ""}
                  color={farSide}
                  mine={named?.mine === farSide}
                  toMove={atAGame && shown?.turn() === farSide}
                  result={
                    named === null ? null : friend.phase.kind === "playing" &&
                      friend.phase.over !== null ? (
                      scoreOf(friend.phase.over.result)
                    ) : friend.phase.kind === "playing" ? (
                      <>
                        <span className="player-live" aria-hidden="true" />
                        In play
                      </>
                    ) : (
                      /*
                        A game read in: which of its lines is on the board, once
                        it has come to a fork and there is more than one, and
                        how that line comes out. In the middle of the row,
                        rather than on a row of its own: a line over the names
                        was taken from the height of the board.
                      */
                      <>
                        {branchLabel}
                        {branchLabel !== null && readResult !== null && (
                          <span className="branch-sep" aria-hidden="true">
                            ·
                          </span>
                        )}
                        {readResult !== null && (
                          <span className="player-score">{scoreOf(readResult)}</span>
                        )}
                      </>
                    )
                  }
                  position={
                    named === null ? null : (
                      <>
                        {/* Nothing can be played from what is showing: an
                            earlier position of a game, a game that is over, or
                            a challenge with no game in it yet. */}
                        {((friend.phase.kind === "playing" &&
                          (history.current !== 0 ||
                            friend.phase.over !== null)) ||
                          friend.phase.kind === "waiting") && <LockIcon />}
                        {counted}
                      </>
                    )
                  }
                />
              )}
              <div className="board-with-bars">
                {/* The boards, which in two board mode are two. Held in a box
                    of their own so the air between them is theirs and not the
                    thinner gap the bars stand off by. */}
                <div className="boards">
                <Board
                position={shown}
                colors={settings.board.squares}
              hedge={settings.board.hedging}
                pieceTint={settings.pieces.tint}
                glyphs={glyphs}
                attacks={settings.attacks}
                fadeTimeMs={fitted(settings.pieces.fadeTimeMs)}
                onMove={handleMove}
                flight={flight}
                onFlightLanded={land}
                showing={during?.board ?? null}
                flying={during?.flying ?? []}
                grid={settings.board.grid}
                playable={playable}
                frozen={frozen}
                onPickUp={() => setInHand("left")}
                pickedUpElsewhere={inHand === "right"}
                editing={editing}
                lastMove={lastMove}
                lastMoveMark={settings.board.lastMove}
                orientation={side}
              />
                {/*
                  And the same position again, drawn from another preset: the
                  classic board, drawn on the left of the main one — see
                  `.app-two-up .boards`.

                  Everything about the picture is the other preset's; everything
                  about the position is this one's, down to the move in the air,
                  so the two boards are one board seen twice rather than two
                  boards that agree. It faces the same way for the same reason:
                  which way round the board is turned is where the reader is
                  sitting, and they are sitting in one place.

                  Moves are played on it as on the main one, by the same rules —
                  a piece is dragged or clicked on either board, since the
                  reader's eye may be on either. What a board holds while a
                  move is being made is its own: the piece picked up, and where
                  it may go, show on that board alone — and picking one up on
                  either board lets go of one picked out on the other, since the
                  reader has one hand. A piece dragged off
                  one board goes back to it rather than onto the other, the
                  pointer being that board's until it is let go. The move, once
                  made, is the game's, and both boards play it.

                  No `onFlightLanded`: the main board reports the landing, and
                  two boards reporting one landing would say it twice.
                */}
                {twoBoard && (
                  <Board
                    position={shown}
                    colors={rightSettings.board.squares}
                    hedge={rightSettings.board.hedging}
                    pieceTint={rightSettings.pieces.tint}
                    glyphs={rightGlyphs}
                    attacks={rightSettings.attacks}
                    fadeTimeMs={fitted(rightSettings.pieces.fadeTimeMs)}
                    flight={flight}
                    showing={during?.board ?? null}
                    flying={during?.flying ?? []}
                    grid={rightSettings.board.grid}
                    onMove={(from, to, dragged) => handleMove(from, to, dragged, undefined, 1)}
                    playable={playable}
                    frozen={frozen}
                    onPickUp={() => setInHand("right")}
                    pickedUpElsewhere={inHand === "left"}
                    editing={editing}
                    lastMove={lastMove}
                    lastMoveMark={rightSettings.board.lastMove}
                    orientation={side}
                  />
                )}
                </div>
                {/* The editor's palette, in the bars' place while it is open. */}
                {editor && (
                  <BoardEditorPalette
                    orientation={side}
                    tool={tool}
                    onTool={setTool}
                    onDrop={(chosen, square) =>
                      editTo(place(editedFen, square, chosen === "erase" ? null : chosen))
                    }
                    onClear={() => editTo(TWO_KINGS)}
                    onUndo={editorPast.length > 0 ? undoEdit : null}
                    onRedo={editorFuture.length > 0 ? redoEdit : null}
                    style={pieceVars(settings.pieces.tint, settings.attacks)}
                    glyphs={glyphs}
                  />
                )}
                {!editor && settings.pieces.showCaptured && (
                  <CapturedBar
                    captures={captures}
                    orientation={side}
                    pieceTint={settings.pieces.tint}
                    glyphs={glyphs}
                    attacks={settings.attacks}
                  />
                )}
                {/* And the men still standing, immediately outside the men who
                    are not — so the board, what it has lost, and what it has
                    left read outwards in that order. */}
                {!editor && settings.pieces.showAvailable && (
                  <AvailableBar
                    position={shown}
                    orientation={side}
                    pieceTint={settings.pieces.tint}
                    glyphs={glyphs}
                    attacks={settings.attacks}
                  />
                )}
              </div>
              {/* And whoever is at this end. */}
              {atAGame && (
                <PlayerName
                  name={named?.names[nearSide] ?? ""}
                  color={nearSide}
                  mine={named?.mine === nearSide}
                  toMove={atAGame && shown?.turn() === nearSide}
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
            inert={exporting}
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
                checked={side === "black"}
                onChange={(flipped) => turnBoard(flipped ? "black" : "white")}
              />
              <button
                type="button"
                className="reset-button controls-end"
                disabled={editor}
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
                  title="First position (Ctrl+←)"
                  aria-label="First position"
                  aria-keyshortcuts="Control+ArrowLeft"
                  disabled={!canGoFirst}
                  onClick={() => stepHistory("first")}
                >
                  <StepIcon direction="first" />
                </button>
                <button
                  type="button"
                  className="reset-button step-button"
                  aria-label="Previous position"
                  aria-keyshortcuts="ArrowLeft"
                  disabled={!canGoPrevious(history)}
                  title="Previous position (←)"
                  onClick={() => stepHistory("previous")}
                >
                  <StepIcon direction="previous" />
                </button>
                <button
                  type="button"
                  className="reset-button step-button"
                  title="Next position (→)"
                  aria-label="Next position"
                  aria-keyshortcuts="ArrowRight"
                  disabled={!canGoNext(history)}
                  onClick={() => stepHistory("next")}
                >
                  <StepIcon direction="next" />
                </button>
                <button
                  type="button"
                  className="reset-button step-button step-button-end"
                  title="Last position (Ctrl+→)"
                  aria-label="Last position"
                  aria-keyshortcuts="Control+ArrowRight"
                  disabled={!canGoLast}
                  onClick={() => stepHistory("last")}
                >
                  <StepIcon direction="last" />
                </button>
                {/* The keys the four buttons answer to, and the two that walk
                    every line, which have no button of their own. */}
                <InfoButton label="Keys for stepping through a game">
                  <dl className="info-keys">
                    <dt>← / →</dt>
                    <dd>The previous or the next position, along the line on the board.</dd>
                    <dt>Ctrl+← / Ctrl+→</dt>
                    <dd>The first position, or the last — of the first line and of the last, in a game with variations.</dd>
                    <dt>Shift+← / Shift+→</dt>
                    <dd>
                      Every line of a game with variations, a move at a time, as Play walks them: on to the end of a
                      line, back to where the next one leaves it, and on along that.
                    </dd>
                    <dt>Space</dt>
                    <dd>Play, or stop.</dd>
                  </dl>
                  The keys work whenever the Lab tab is open and no field has the keyboard.
                </InfoButton>
              </div>
              <div className="board-controls play-row">
                <button
                  type="button"
                  className="reset-button play-button"
                  title={
                    playing
                      ? "Hold the game where it stands (Space)"
                      : "Play the game through, a position at a time — from wherever it stands (Space)"
                  }
                  aria-pressed={playing}
                  aria-keyshortcuts="Space"
                  /* Nothing ahead of it is nothing to play: at the last
                     position the button has no work to do, and saying so is
                     better than starting the game again from the top under a
                     word that promises to carry on. */
                  /* Whatever the navigation can do, this can do: playing a
                     game through is the same walk taken at a pace, and while a
                     game with somebody else is on it is reading rather than
                     playing — which is exactly what stepping through it is. */
                  disabled={(!playing && still.length === 0) || editor}
                  onClick={playOrStop}
                >
                  <PlayIcon playing={playing} />
                  {playing ? "Pause / Stop" : "Play / Resume"}
                </button>
                {/*
                  The paces it plays at, each flush right, so their boxes and
                  their units stand in columns: the wait before the first move
                  and the one between moves, then the two a game with
                  variations adds — the way back to a fork, and the hold at the
                  end of each line. Two to a row where the panel is wide enough
                  for that, under the button; one to a row otherwise, the first
                  beside it. See `.play-row`.
                */}
                <NumberField
                  id="play-initial-delay"
                  disabled={editor}
                  inline
                  narrow
                  allowZero
                  label="Initial delay"
                  suffix="seconds"
                  step={0.1}
                  value={initialDelay}
                  hint={
                    "How long the game waits after Play before its first move, wherever in the game it starts. " +
                    "Time to get the board into view — when recording in two board mode, this button is below the boards. " +
                    "Nought starts at once."
                  }
                  onChange={(playInitialDelaySec) =>
                    setSettings({
                      ...settings,
                      lab: { ...settings.lab, playInitialDelaySec },
                    })
                  }
                />
                <NumberField
                  id="play-period"
                  disabled={editor}
                  inline
                  narrow
                  label="Period per position"
                  suffix="seconds"
                  step={0.5}
                  value={period}
                  hint={
                    "How long each position is left on the board while the game plays."
                  }
                  onChange={(playPeriodPerPositionSec) =>
                    setSettings({
                      ...settings,
                      lab: { ...settings.lab, playPeriodPerPositionSec },
                    })
                  }
                />
                <NumberField
                  id="play-back-step"
                  disabled={editor}
                  inline
                  narrow
                  allowZero
                  label="Back step period"
                  suffix="seconds"
                  step={0.05}
                  value={backStep}
                  hint="In a game with variations, how long each position stands on the way back to the fork the next line leaves from. Nobody is reading them, so it can be short."
                  onChange={(playBackStepSec) =>
                    setSettings({
                      ...settings,
                      lab: { ...settings.lab, playBackStepSec },
                    })
                  }
                />
                <NumberField
                  id="play-back-speedup"
                  disabled={editor}
                  inline
                  narrow
                  label="Back step speedup factor"
                  suffix="×"
                  step={0.05}
                  value={settings.lab.playBackStepSpeedup}
                  hint="How much faster a piece goes back on those steps than it moves forward: the move time is divided by this, and the move speed multiplied by it. 1 plays them at the pace of the moves. Stepping back by hand is not affected."
                  onChange={(playBackStepSpeedup) =>
                    setSettings({
                      ...settings,
                      lab: { ...settings.lab, playBackStepSpeedup },
                    })
                  }
                />
                <NumberField
                  id="play-line-end"
                  disabled={editor}
                  inline
                  narrow
                  allowZero
                  label="Hold at the end of a line"
                  suffix="seconds"
                  step={0.5}
                  value={lineEndHold}
                  hint="How long the last position of each line of a game with variations stands before the game goes back for the next — the mate the line was played to show. An animated GIF holds its very last position this long before it starts again, whatever the game."
                  onChange={(playLineEndHoldSec) =>
                    setSettings({
                      ...settings,
                      lab: { ...settings.lab, playLineEndHoldSec },
                    })
                  }
                />
              </div>
              <div className="board-controls lines-row">
                <MovesSelect
                  entries={history.entries}
                  current={history.current}
                  disabled={editor}
                  onSelect={(index) => {
                    setPlaying(false);
                    showHistory(goToPosition(history, index));
                  }}
                />
                {/* Which line of a game with variations is on the board, to
                    choose one by hand: the walk plays them all, and this is how
                    to stop at one and study it. */}
                {readGame !== null && readGame.lines.length > 1 && (
                  <SelectField
                    id="branch"
                    label="Line"
                    capped
                    value={String(onLine)}
                    choices={readGame.lines.map((line, index) => ({
                      value: String(index),
                      label: `${index + 1} of ${readGame.lines.length}: ${line.choices.join(" › ")}`,
                    }))}
                    hint="Which line of the game's variations is on the board. The board stays where it is if the new line passes through it, and otherwise goes back to where the two lines part. Shift+→ and Shift+← walk every line a move at a time, as Play does: on to the end of a line, back to where the next one leaves it, and on along that."
                    onChange={(value) => {
                      const target = Number(value);
                      const depth = Math.min(
                        history.entries.length - 1 - history.current,
                        sharedMoves(readGame.lines[onLine], readGame.lines[target])
                      );
                      setPlaying(false);
                      switchLine(target, depth);
                    }}
                  />
                )}
                {/* The lines played before the one on the board let go of;
                    see `clearLinesBefore`. */}
                <span className="field-label">
                  <button
                    type="button"
                    className="reset-button"
                    disabled={!canClearLines}
                    onClick={clearLinesBefore}
                  >
                    Clear lines before current
                  </button>
                  <InfoButton label="Clear lines before current">
                    Takes away every line that comes before the one on the board, in the order the lines are played
                    — the order Play and Shift+→ walk them. The line on the board stays, with every line after it,
                    and becomes the first line of the game.
                  </InfoButton>
                </span>
              </div>
              {/* Whether moves made on the board keep what they branch away
                  from. Switched off, every line but the way from the first
                  position to the board's goes; see `clearOtherLines`. */}
              <ToggleField
                id="keep-variations"
                label="Keep variations"
                checked={treeMode}
                disabled={editor}
                hint="Keeps every line played here. A move made from an earlier position starts a variation rather than replacing the moves that followed it, and every line can be chosen, played and exported as one game with variations — for recording a task's answer to each defence, say. Switched off, only the moves from the start to the position on the board are kept."
                onChange={(on) => {
                  setTreeMode(on);
                  if (!on) {
                    clearOtherLines();
                  }
                }}
              />
            </div>

            {/* Second row: what a whole game can be done with. */}
            {/* Open while a game with somebody else is on, as everything on
                this tab is: a position put on the board steps away from the
                game, which stays in the list to be gone back to — as one that
                is over does. */}
            <FenField
              value={fen}
              error={error}
              onChange={enterPosition}
              after={
                <button
                  type="button"
                  className="reset-button editor-button"
                  /* Done, like the one over the board, only on a position a
                     game could reach: leaving on any other would throw the
                     work away for the starting position. */
                  disabled={editor && boardEditorProblems(editedFen).length > 0}
                  title={
                    !editor
                      ? "Set up a position piece by piece"
                      : boardEditorProblems(editedFen).length > 0
                        ? "No game could reach this position yet: see the red cross."
                        : "Finish setting up, and start from this position"
                  }
                  onClick={!editor ? openEditor : closeEditor}
                >
                  {/* Whichever it says, as wide as the longer of the two, both
                      held in the same place unseen: the field beside it keeps
                      its width as the editor opens and closes. */}
                  <span className="editor-button-label">{!editor ? "Board editor" : "Done editing"}</span>
                  <span className="editor-button-room" aria-hidden="true">
                    Board editor
                  </span>
                  <span className="editor-button-room" aria-hidden="true">
                    Done editing
                  </span>
                </button>
              }
            />
            <SectionRule name="Import / export" />

            {/* The two that move a game in and out of PGN, and the link to it. */}
            <div className="board-controls">
              <span className="field-label">
                <button
                  type="button"
                  className="reset-button"
                  disabled={editor}
                  onClick={() => setPgnOpen(true)}
                >
                  Import game (PGN)
                </button>
                <InfoButton label="PGN">
                  <PgnHelp />
                </InfoButton>
              </span>
              <button
                type="button"
                className="reset-button"
                onClick={() => setPgnExportOpen(true)}
              >
                Export game (PGN)
              </button>
              <div className="controls-end share-actions">
                <ToggleField
                  id="share-autoplay"
                  label="With autoplay"
                  disabled={editor}
                  hint="The link sets the game playing from its first position, at whatever pace the reader's own settings say."
                  checked={settings.lab.shareGameWithAutoplay}
                  onChange={(shareGameWithAutoplay) =>
                    setSettings({
                      ...settings,
                      lab: { ...settings.lab, shareGameWithAutoplay },
                    })
                  }
                />
                <CopyButton
                  label="Share game"
                  icon={<ShareIcon />}
                  title={
                    settings.lab.shareGameWithAutoplay
                      ? "Copy a link that plays this game through from its first position"
                      : "Copy a link that opens this game at its first position"
                  }
                  text={() => {
                    const pgn = sharablePgn();
                    return pgn === null
                      ? null
                      : gameLink(pgn, settings.lab.shareGameWithAutoplay);
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
                disabled={stashName === null || editor}
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
                disabled={editor}
                onClick={() => setStashDialogOpen(true)}
              >
                Stash game as {"\u2026"}
              </button>
              <StashedGames
                stash={stash}
                value={stashName}
                locked={editor ? "Not while the board is being set up" : null}
                /* Read afresh as the list is opened, so a game another tab put
                   aside a moment ago is in it. */
                onOpen={freshStash}
                onSelect={loadStashedGame}
              />
            </div>

            <SectionRule name="Library" />

            <div className="board-controls">
              <GameLibrary
                value={libraryGame}
                error={libraryGameError}
                locked={editor ? "Not while the board is being set up" : null}
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
                  checked={side === "black"}
                  onChange={(flipped) => turnBoard(flipped ? "black" : "white")}
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
                anyGames={friend.games.length > 0}
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
                  {/*
                    Steps away from the game and leaves it in the list. Nothing
                    is given up: the seat, the token and the row stay, and the
                    board goes back to being a board — a position to look at, a
                    game to load from the library, a line to play out.

                    At the other end of the row from the two that act on the
                    list: this one is about the game in front of the reader, and
                    a button that puts something down should not sit against the
                    one that throws things away.
                  */}
                  <button
                    type="button"
                    className="reset-button games-step-away"
                    disabled={friend.phase.kind === "idle"}
                    title={
                      friend.phase.kind === "idle"
                        ? "No game is being shown"
                        : "Stop showing this game. It stays in the list."
                    }
                    onClick={() => {
                      setTicked(new Set());
                      putBoardDown();
                    }}
                  >
                    <ExitIcon />
                    Step away
                  </button>
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
                  label="Attack rays"
                  on={settings.attacks.rays.show}
                  onOn={(show) =>
                    setSettings({
                      ...settings,
                      attacks: {
                        ...settings.attacks,
                        rays: { ...settings.attacks.rays, show },
                      },
                    })
                  }
                  value={settings.attacks.rays.intensity}
                  colorAt={rayFieldColor}
                  full={rayFull}
                  /* The two switches that stand between the choosers, level
                     with the readings they answer for: a side turned off here
                     is left out of both pictures. */
                  aside={{
                    top: <SideSwitch side="Opponent" of={sideShown("Opponent")} />,
                    bottom: <SideSwitch side="Mine" of={sideShown("Mine")} />,
                  }}
                  onChange={(rayIntensity) => setIntensity({ rays: rayIntensity })}
                />
                {/* Level with the two squares, which now sit on the middle of
                    the panel — as this does, the holder being full height. */}
                <div className="intensity-link-holder">
                  <div className="intensity-link-middle">
                    <button
                      type="button"
                      className="intensity-link"
                      aria-pressed={settings.attacks.raysAndHeatmapIntensityLinked}
                      title={
                        settings.attacks.raysAndHeatmapIntensityLinked
                          ? "Rays and heatmap move together. Press to part them."
                          : "Rays and heatmap move separately. Press to hold them equal, at the rays' setting."
                      }
                      onClick={() =>
                        linkIntensity(!settings.attacks.raysAndHeatmapIntensityLinked)
                      }
                    >
                      <LinkIcon closed={settings.attacks.raysAndHeatmapIntensityLinked} />
                    </button>
                  </div>
                </div>
                <IntensityChooser
                  id="heatmap-intensity"
                  label="Heatmap"
                  on={settings.attacks.heatmap.show}
                  onOn={(show) =>
                    setSettings({
                      ...settings,
                      attacks: {
                        ...settings.attacks,
                        heatmap: { ...settings.attacks.heatmap, show },
                      },
                    })
                  }
                  value={settings.attacks.heatmap.intensity}
                  colorAt={heatFieldColor}
                  full={heatFull}
                  onChange={(intensity) => setIntensity({ heatmap: intensity })}
                />
              </div>
            </div>
          )}

          {tab === "gif" && (
            <div
              className="tab-panel"
              role="tabpanel"
              id="panel-gif"
              aria-labelledby="tab-gif"
            >
              <Suspense fallback={<p className="invite-note">Loading…</p>}>
              <GifExportPanel
                driver={gifDriver}
                initialDelayMs={settings.lab.playInitialDelaySec * 1000}
                periodMs={Math.max(settings.lab.playPeriodPerPositionSec, 0.1) * 1000}
                backStepMs={settings.lab.playBackStepSec * 1000}
                lineEndHoldMs={settings.lab.playLineEndHoldSec * 1000}
                players={named === null ? null : { white: named.names.w, black: named.names.b }}
                keptAs={stashName}
                twoBoards={twoBoard}
                positions={history.entries.length}
                branches={readGame === null ? 1 : readGame.lines.length}
                look={gifLook}
                game={readGame !== null ? readGame.pgn : `${here.initialFEN} ${here.moves.join(" ")}`}
                onExporting={(on) => {
                  exportingRef.current = on;
                  setExporting(on);
                }}
              />
              </Suspense>
            </div>
          )}

          {tab !== "game" && tab !== "match" && tab !== "balance" && tab !== "gif" && (
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
                onChange={setSettings}
                presetName={presets.target}
                onBring={presets.bring}
                askBeforeDiscard={askBeforeDiscard}
                onAskBeforeDiscard={(on) => {
                  setAskBeforeDiscard(on);
                  setAsking(on);
                }}
                /* Read afresh as the tab is drawn, so the count is this
                   browser's rather than this tab's. */
                stashed={stash.length}
                onForgetStashes={forgetStashes}
                twoBoard={twoBoard}
                onTwoBoard={(on) => {
                  setTwoBoard(on);
                  setTwoBoardMode(on);
                }}
                rightPreset={rightNamed}
                rightPresetChoices={rightChoices}
                onRightPreset={(name) => {
                  setRightPreset(name);
                  setTwoBoardPreset(name);
                }}
                presets={
                  <section className="preset-panel" aria-label="Settings presets">
                    <p className="invite-heading">Settings presets</p>
                    {/* The list is what scrolls, not the tab: see
                        `.presets-scroll`, which is the games list's rule said
                        again for this one. */}
                    <div className="presets-scroll">
                    <PresetList
                      rows={presets.rows}
                      target={presets.target}
                      dirty={presets.dirty}
                      chosen={tickedPresets}
                      onOpen={(name) => {
                        setTickedPresets(new Set());
                        presets.choose(name);
                      }}
                      onChoose={(name, on) =>
                        setTickedPresets((was) => {
                          const next = new Set(was);
                          if (on) {
                            next.add(name);
                          } else {
                            next.delete(name);
                          }
                          return next;
                        })
                      }
                    />
                    </div>
                    <div className="board-controls preset-actions">
                      <div className="button-pair preset-pair">
                      <button
                        type="button"
                        className="reset-button"
                        disabled={tickedPresets.size === 0}
                        title={
                          tickedPresets.size === 0
                            ? "Tick the presets to remove"
                            : "Remove the ticked presets"
                        }
                        onClick={() => {
                          presets.remove([...tickedPresets]);
                          setTickedPresets(new Set());
                        }}
                      >
                        <ForgetIcon />
                        Remove selected
                      </button>
                      <button
                        type="button"
                        className="reset-button"
                        title="Save the settings on the board under a name of your own"
                        onClick={() => setNamingPreset(true)}
                      >
                        Save as …
                      </button>
                      </div>
                    </div>
                  </section>
                }
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

      {/*
        One box for two questions that want the same answer: "give these
        settings a name", asked because the reader pressed Save as, and asked
        because they are about to be replaced by something else. The second is
        the one that can be turned off.
      */}
      <SaveAsDialog
        open={namingPreset || presets.pending !== null}
        confirming={presets.pending !== null}
        trouble={(name) =>
          nameTrouble(name, presets.mine, presets.unreadable)
        }
        askAgain={askBeforeDiscard}
        onAskAgain={(on) => {
          setAskBeforeDiscard(on);
          setAsking(on);
        }}
        onSave={(name) => {
          presets.saveAs(name, presets.pending);
          setNamingPreset(false);
        }}
        onDiscard={() => {
          presets.discard();
          setNamingPreset(false);
        }}
        onClose={() => {
          presets.keep();
          setNamingPreset(false);
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
      {/* Asked before the board editor takes the place of a game on the board:
          either answer opens it, on the position the board was on. */}
      <StashDialog
        open={stashingForEditor}
        taken={stash.map((game) => game.name)}
        initialName={nextStashName(stash.map((game) => game.name))}
        prompt="Stash current game?"
        submitLabel="Stash"
        dismissLabel="Don't stash"
        onSubmit={(name) => {
          const refused = putAside(name);
          if (refused !== undefined) {
            return refused;
          }
          startEditing();
        }}
        onClose={startEditing}
      />
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
          const refused = putAside(name);
          if (refused !== undefined) {
            return refused;
          }
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
      {/* What a pawn reaching the last rank becomes; see `handleMove`. Only
          while the board still holds the position it was asked about. */}
      {promoting !== null && shown !== null && shown.fen() === promoting.fen && (
        <PromotionChooser
          color={promoting.color}
          square={() =>
            document
              .querySelectorAll(".board-holder > svg")
              [promoting.board]?.querySelector(`.square-layer [data-square="${promoting.to}"]`)
              ?.getBoundingClientRect() ?? null
          }
          /* White promotes on the eighth rank, at the top when White is at the
             bottom; Black on the first. */
          at={(promoting.color === "w") === (side === "white") ? "top" : "bottom"}
          onChoose={(piece) => {
            const asked = promoting;
            setPromoting(null);
            handleMove(asked.from, asked.to, false, piece);
          }}
          onCancel={() => setPromoting(null)}
          glyphs={promoting.board === 1 ? rightGlyphs : glyphs}
        />
      )}
    </main>
  );
}
