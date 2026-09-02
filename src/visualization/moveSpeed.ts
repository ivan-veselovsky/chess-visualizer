import type { MoveMotion } from "./settings";

/**
 * How fast a piece should cross `squares` squares, in squares a second.
 *
 *   v = speed · (1 − blend) + blend · pi · squares / (2 · time)
 *
 * The first term is a rate that does not care how far the piece is going, so
 * the journey takes as long as it is long. The second is a rate chosen to make
 * the journey take `time` whatever its length, and the whole of it goes into
 * making that literally true.
 *
 * Where the pi over two comes from: this is a peak speed, not an average one.
 * The piece gathers pace and loses it again along a half sine, whose average is
 * two over pi of its peak, so a journey at peak `v` takes `pi·L / (2·v)`. Plain
 * `L / time` would therefore have taken `pi/2` — about one and a half — times
 * the seconds asked for, and a field marked in seconds has to mean them.
 *
 * The point of mixing rather than choosing: at a constant rate a one-square
 * move is over before it registers and a rook's run across the board is a wait,
 * while holding the time flat makes a short move crawl. A little of the second
 * pulls both ends towards the middle.
 */
export function moveSpeed(motion: MoveMotion, squares: number): number {
  const blend = Math.min(Math.max(motion.blend, 0), 1);
  const held =
    motion.time > 0 ? (Math.PI * squares) / (2 * motion.time) : 0;
  return motion.speed * (1 - blend) + blend * held;
}
