import type { ReactElement } from "react";
import { knightAttackedSquares } from "../../../chess/attacks";
import {
  BOARD_SIZE,
  SQUARE_SIZE,
  ringSectorInsideRect,
  sectorPath,
  squareBox,
  squareCenter,
} from "../../geometry";
import { stripeBands } from "./bands";
import {
  diagonalGammaSector,
  orthogonalGammaBar,
  outerMeeting,
  squareBeyondRadius,
  targetSides,
} from "./knightGamma";
import type { PieceAttackProps } from "./types";

/**
 * A ring bounded by two circles centred on the knight, shown on the eight
 * squares it attacks and nowhere else.
 *
 * The annulus is drawn as a stroked circle at the mid-radius, its width
 * spanning the gap between the two bounding circles, which avoids an even-odd
 * two-subpath fill.
 *
 * How it ends on each square is a choice of three:
 *
 * - **Arc** cuts it along two radii, taking the widest piece of ring that fits
 *   inside the square whole, so the piece keeps its thickness to both ends.
 * - **Orthogonal gamma** lets the square itself cut the arc, and adds a bar of the
 *   ring's own thickness lying along `b` and running back to `c` — a tail that
 *   follows the board's lines rather than the circle's.
 * - **Diagonal gamma 1 and 2** cut the arc radially as the first does, and add a
 *   radial tail leaning in towards the knight — cut off by `c` in the first,
 *   stopped on a circle of its own in the second.
 *
 * Both tails point back the way the knight came; they differ in whether they
 * follow the grid or the radius. The diagonal one comes in two, differing only
 * in how its far end is cut.
 */
export default function KnightAttacks({
  piece,
  idPrefix,
  orientation,
  attackOptions,
  geometry,
}: PieceAttackProps) {
  const clipId = `${idPrefix}-ring`;
  const { innerRadius, outerRadius, gapWidth } = geometry.knightRing;

  // Tolerate the two radii being given the wrong way round.
  const inner = Math.min(innerRadius, outerRadius) * SQUARE_SIZE;
  const outer = Math.max(innerRadius, outerRadius) * SQUARE_SIZE;

  // The ring is a stripe bent into a circle: its thickness is the outer width
  // and the gap down its middle the inner one, so the same rule that doubles a
  // ray's stripe doubles this ring. Each band's offset is then radial.
  const bands = stripeBands({ rayWidth: (outer - inner) / SQUARE_SIZE, gapWidth });
  if (bands.length === 0) {
    return null;
  }
  const midRadius = (inner + outer) / 2;
  const thickness = outer - inner;
  const center = squareCenter(piece.square, orientation);
  const targets = knightAttackedSquares(piece.square);
  const gamma = attackOptions.knightGeometry;

  // What the ring is cut to on each square, and whatever the gamma tails add.
  const sectorRadius = outer + SQUARE_SIZE;
  const cuts: { key: string; d?: string; box?: ReturnType<typeof squareBox> }[] = [];
  const tails: { key: string; shape: ReactElement }[] = [];
  // Where each diagonal tail stops, as a radius about the knight.
  const stops: { key: string; radius: number }[] = [];

  for (const target of targets) {
    const box = squareBox(target, orientation);
    const sides = targetSides(piece.square, target, orientation);
    if (sides === null) {
      continue;
    }

    /*
      Every geometry cuts the arc radially where it leaves by `d`, on the ray
      out to where the outer circle meets that side — the same ray each tail is
      anchored to, so arc and tail meet without a seam. Left to the square, the
      arc runs on past `d` and comes to a spur of its own beside the real one.

      They differ at the other end. All but orthogonal gamma cut there radially too,
      taking the widest piece that fits the square whole. Orthogonal gamma runs out to
      `b` instead, because its bar carries on from where it lands.
    */
    if (gamma === "orthogonal-gamma") {
      const onD = outerMeeting(center, sides.d, box, outer);
      const path =
        onD === null
          ? null
          : squareBeyondRadius(center, onD, squareCenter(target, orientation), box);
      cuts.push(path === null ? { key: target, box } : { key: target, d: path });
    } else {
      const span = ringSectorInsideRect(center, inner, outer, box);
      if (span !== null) {
        cuts.push({ key: target, d: sectorPath(center, span[0], span[1], sectorRadius) });
      }
    }

    if (gamma === "arc") {
      continue;
    }
    if (gamma === "orthogonal-gamma") {
      const bar = orthogonalGammaBar(center, sides, inner, thickness);
      if (bar !== null) {
        tails.push({
          key: target,
          shape: <rect {...bar} className="attack-area attack-knight-area" />,
        });
      }
    } else if (gamma === "diagonal-gamma-1" || gamma === "diagonal-gamma-2") {
      const wedge = diagonalGammaSector(center, sides, outer, thickness);
      if (wedge !== null) {
        /*
          The two diagonals part company only here, at the tail's inner end.
          The first lets `c` cut it off straight; the second stops it on a
          circle struck through where the radial edge leaves by `c`, so that
          both of its ends are arcs about the knight.
        */
        const stopped = gamma === "diagonal-gamma-2";
        if (stopped) {
          stops.push({ key: target, radius: wedge.stopRadius });
        }
        const area = (
          <path d={wedge.path} className="attack-area attack-knight-area" />
        );
        tails.push({
          key: target,
          shape: (
            <g clipPath={`url(#${idPrefix}-${target}-square)`}>
              <g clipPath={`url(#${idPrefix}-outer)`}>
                {stopped ? (
                  <g clipPath={`url(#${idPrefix}-${target}-stop)`}>{area}</g>
                ) : (
                  area
                )}
              </g>
            </g>
          ),
        });
      }
    }
  }

  if (cuts.length === 0) {
    return null;
  }

  return (
    <g>
      <clipPath id={clipId}>
        {cuts.map(({ key, d, box }) =>
          d === undefined ? <rect key={key} {...box} /> : <path key={key} d={d} />
        )}
      </clipPath>
      {(gamma === "diagonal-gamma-1" || gamma === "diagonal-gamma-2") && (
        <>
          <clipPath id={`${idPrefix}-outer`}>
            <circle cx={center.x} cy={center.y} r={outer} />
          </clipPath>
          {targets.map((target) => (
            <clipPath key={target} id={`${idPrefix}-${target}-square`}>
              <rect {...squareBox(target, orientation)} />
            </clipPath>
          ))}
          {/* Everything outside the stop circle, by the even-odd rule. */}
          {stops.map(({ key, radius }) => (
            <clipPath key={key} id={`${idPrefix}-${key}-stop`} clipRule="evenodd">
              <path
                d={
                  `M 0 0 h ${BOARD_SIZE} v ${BOARD_SIZE} h ${-BOARD_SIZE} Z ` +
                  `M ${center.x - radius} ${center.y} ` +
                  `a ${radius} ${radius} 0 1 0 ${radius * 2} 0 ` +
                  `a ${radius} ${radius} 0 1 0 ${-radius * 2} 0 Z`
                }
                clipRule="evenodd"
              />
            </clipPath>
          ))}
        </>
      )}
      {bands.map((band, index) => {
        const radius = midRadius + band.offset;
        // A gap wider than the ring would push a band through the centre.
        return radius <= 0 ? null : (
          <circle
            key={index}
            cx={center.x}
            cy={center.y}
            r={radius}
            className="attack-stripe attack-knight"
            strokeWidth={band.width}
            clipPath={`url(#${clipId})`}
          />
        );
      })}
      {tails.map(({ key, shape }) => (
        <g key={key}>{shape}</g>
      ))}
    </g>
  );
}
