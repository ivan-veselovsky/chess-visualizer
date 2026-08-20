import { SQUARE_SIZE } from "../../geometry";
import type { RayStyle } from "../../options";

/** One band of a stripe: how far off the centre line, and how thick. */
export interface Band {
  offset: number;
  width: number;
}

/**
 * Resolves a stripe style into the bands to actually stroke.
 *
 * The stripe is an outer stripe minus an inner one, which leaves two bands
 * running either side of the centre line. Rather than a real path subtraction
 * each band is stroked directly: it is `(outer - inner) / 2` thick and sits
 * `(outer + inner) / 4` off centre. When the inner width is zero there is
 * nothing to subtract, so a single centred band of the full width is used —
 * two touching bands would otherwise show a seam where they meet.
 *
 * Shared by every mark drawn as a stripe: the sliding pieces' rays, the king's,
 * and the pawn's.
 */
export function stripeBands({ rayWidth, gapWidth }: RayStyle): Band[] {
  // Both to pixels before clamping — an inner width above the outer one would
  // otherwise yield negative band widths.
  const outer = Math.max(rayWidth, 0) * SQUARE_SIZE;
  const inner = Math.min(Math.max(gapWidth, 0) * SQUARE_SIZE, outer);

  if (outer === 0) {
    return [];
  }
  if (inner === 0) {
    return [{ offset: 0, width: outer }];
  }
  const width = (outer - inner) / 2;
  if (width === 0) {
    return [];
  }
  const offset = (outer + inner) / 4;
  return [
    { offset: -offset, width },
    { offset, width },
  ];
}
