/**
 * Positions worth looking at through the visualizer: sharp middlegames where
 * the pieces' reach is the whole story, and endgame studies small enough that
 * every line on the board can be followed at once.
 *
 * The title is what the dropdown shows; the FEN is what it loads.
 */
export interface FamousPosition {
  title: string;
  fen: string;
}

const BOTVINNIK_CAPABLANCA: FamousPosition = {
  title: "Botvinnik–Capablanca, AVRO 1938",
  fen: "8/p3q1kp/1p2Pnp1/3pQ3/2pP4/1nP3N1/1B4PP/6K1 w - - 5 30",
};

export const FAMOUS_POSITIONS: FamousPosition[] = [
  {
    title: "Donald Byrne–Bobby Fischer, 1956",
    fen: "r1b1r1k1/pp3pbp/1qp3p1/2B5/2BP4/Q1n2N2/P4PPP/3R1K1R b - - 3 17",
  },
  BOTVINNIK_CAPABLANCA,
  {
    title: "Kasparov–Topalov, Wijk aan Zee 1999",
    fen: "b2r3r/k4p1p/p2q1np1/NppP4/3p1Q2/P4PPB/1PP4P/1K1RR3 w - - 1 24",
  },
  {
    title: "Topalov–Shirov, Linares 1998",
    fen: "8/8/4kpp1/3p1b2/p6P/2B5/6P1/6K1 b - - 0 47",
  },
  {
    title: "The Saavedra position",
    fen: "8/8/1KP5/3r4/8/8/8/k7 w - - 0 1",
  },
  {
    title: "Levitsky–Marshall, Breslau 1912",
    fen: "5rk1/pp4pp/4p3/2R3Q1/3n4/2q4r/P1P2PPP/5RK1 b - - 1 23",
  },
  {
    title: "Morphy–Duke of Brunswick and Count Isouard, 1858",
    fen: "4kb1r/p2npppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 0 16",
  },
  {
    title: "Steinitz–von Bardeleben, Hastings 1895",
    fen: "r1r1k3/pp1qn2p/5pp1/3p2N1/6Q1/8/PP3PPP/2R1R1K1 w - - 2 22",
  },
  {
    title: "Réti endgame study, 1921",
    fen: "7K/8/k1P5/7p/8/8/8/8 w - - 0 1",
  },
  {
    title: "The Lucena position",
    fen: "1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1",
  },
];

/**
 * The position the app opens on. Named rather than taken by index, so
 * reordering the list above cannot quietly change what loads at startup.
 */
export const STARTUP_POSITION = BOTVINNIK_CAPABLANCA;
