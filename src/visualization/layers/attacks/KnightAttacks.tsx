import { Fragment, type ReactElement } from "react";
import { knightAttackedSquares } from "../../../chess/attacks";
import {
  BOARD_SIZE,
  SQUARE_SIZE,
  needlePath,
  rayBaseCorners,
  ringCapSpanInsideRect,
  ringSectorInsideRect,
  sectorPath,
  squareBox,
  squareCenter,
} from "../../geometry";
import { stripeBands } from "./bands";
import { innerSquares } from "./innerSquares";
import {
  diagonalGammaSector,
  diagonalTailFromB,
  spanFromCorner,
  spanToStripe,
  outerMeeting,
  targetSides,
} from "./knightGamma";
import type { PieceAttackProps } from "./types";

/** A rectangle as a closed subpath, for combining with others. */
function rectPath(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}): string {
  return `M ${box.x} ${box.y} h ${box.width} v ${box.height} h ${-box.width} Z`;
}

/**
 * One knight move as a straight ray: a stripe of the ring's own thickness, run
 * from the knight towards the square it reaches, with a point on the end.
 *
 * It stops where the ring's outer circle crosses it — the far corners sit on
 * that circle rather than short of it, so eight of these end where the ring the
 * other modes draw would have run.
 *
 * The point is a right angle whose sides meet the stripe's axis at 45 degrees,
 * which fixes how far it reaches out: half the width of the stripe. Stripe and
 * point are one closed outline rather than two shapes meeting, there being no
 * placing two shapes edge to edge without a hairline showing between.
 */
function straightRayPath(
  center: { x: number; y: number },
  aim: number,
  radius: number,
  width: number
): string {
  const half = width / 2;
  const reach = Math.sqrt(Math.max(radius * radius - half * half, 0));
  const along = { x: Math.cos(aim), y: Math.sin(aim) };
  const across = { x: -along.y, y: along.x };
  const at = (forward: number, sideways: number): string =>
    `${center.x + along.x * forward + across.x * sideways} ${
      center.y + along.y * forward + across.y * sideways
    }`;
  return [
    `M ${at(0, -half)}`,
    `L ${at(reach, -half)}`,
    `L ${at(reach + half, 0)}`,
    `L ${at(reach, half)}`,
    `L ${at(0, half)}`,
    "Z",
  ].join(" ");
}

/**
 * A ring bounded by two circles centred on the knight, shown on the eight
 * squares it attacks and nowhere else.
 *
 * The annulus is drawn as a stroked circle at the mid-radius, its width
 * spanning the gap between the two bounding circles, which avoids an even-odd
 * two-subpath fill.
 *
 * How it ends on each square is a choice of four:
 *
 * - **Arc** cuts it along two radii, taking the widest piece of ring that fits
 *   inside the square whole, so the piece keeps its thickness to both ends.
 * - **Rounded arc** ends it in a half-disc instead, of the ring's own thickness
 *   across, laid against the side of the square that stopped it — so a piece of
 *   ring reads as one stroke with its ends turned, rather than as a wedge.
 * - **Gamma 1** adds a radial stripe leaning in from `d`, above the arc, and
 *   brings the arc's other end in towards `b` to meet the square's own corner.
 * - **Gamma 2** puts the stripe on the other side: rising from the corner where
 *   `b` and `c` meet, beneath the arc, which stops on the stripe's far side.
 *
 * Both stripes point back the way the knight came, and each mode also shows
 * where its stripes set off from, on the knight's own square: by the corners
 * for the first, by the sides for the second, which is where each mode's
 * stripes happen to gather.
 *
 * **Straight ray** is the fourth and draws no ring at all — the whole journey
 * of each move instead, straightened out. It is handled on its own, ahead of
 * everything the other three share.
 */
export default function KnightAttacks({
  piece,
  idPrefix,
  orientation,
  rays,
  geometry,
}: PieceAttackProps) {
  const clipId = `${idPrefix}-ring`;
  const { innerRadius, width, gapWidth } = geometry.knightRing;

  // Where it begins and where it ends. A negative of either is nothing to draw
  // rather than a ring turned inside out.
  const inner = Math.max(innerRadius, 0) * SQUARE_SIZE;
  const outer = inner + Math.max(width, 0) * SQUARE_SIZE;

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
  const gamma = rays.knightGeometry;

  if (gamma === "straight-ray") {
    /*
      No ring here: each move is a stripe of its own, run from the knight
      towards the square it reaches and stopping where the ring's outer circle
      crosses it. It is the ring's own thickness across for its whole length, so
      a row of them reads as the ring the other modes draw, broken into its
      eight pieces and straightened out.

      Where it stops it comes to a point, which says which way the move went — a
      stripe alone reads much the same from either end.

      The whole stripe shows, not only its far end. Where it merely passes over —
      the knight's own square, and the ones between — it is drawn at the decay
      the settings give; where it arrives it is drawn plainly. The decay is a
      factor rather than an opacity, and what it is a factor of is applied
      outside this layer: `AttackLayer` puts the side's ray opacity on the whole
      piece at once, so the two multiply and the trails follow the rays. Passing
      over its own square is exempted inside the large inner square, so eight
      stripes do not converge on the glyph.
    */
    const moves = targets.map((target) => {
      const middle = squareCenter(target, orientation);
      const aim = Math.atan2(middle.y - center.y, middle.x - center.x);
      /*
        As a needle, the same move narrows: the ring's own thickness where it
        leaves the knight, and a point where the stripe's point would have
        been. Only this mode is touched — the ring the other three draw is a
        ring whatever shape rays are given, and a needle has no place in it.
      */
      const half = thickness / 2;
      const reach = Math.sqrt(Math.max(outer * outer - half * half, 0));
      return {
        target,
        d:
          rays.shape !== "stripe"
            ? needlePath(
                /* On the knight's own large inner square, where the stripe is
                   punched out below — an oblique line, so the two corners of
                   the base leave that square at different distances and each
                   is followed to where it does. */
                rayBaseCorners(
                  center,
                  { x: Math.cos(aim), y: Math.sin(aim) },
                  innerSquares(geometry).large,
                  half
                ),
                {
                  x: center.x + Math.cos(aim) * (reach + half),
                  y: center.y + Math.sin(aim) * (reach + half),
                },
                rays.shape
              )
            : straightRayPath(center, aim, outer, thickness),
      };
    });
    const large = innerSquares(geometry).large;

    return (
      <g>
        <clipPath id={`${idPrefix}-passing`} clipRule="evenodd">
          {/* The board with the knight's large inner square punched out. */}
          <path
            clipRule="evenodd"
            d={
              rectPath({ x: 0, y: 0, width: BOARD_SIZE, height: BOARD_SIZE }) +
              " " +
              rectPath({
                x: center.x - large,
                y: center.y - large,
                width: large * 2,
                height: large * 2,
              })
            }
          />
        </clipPath>
        {targets.map((target) => (
          <clipPath key={target} id={`${idPrefix}-${target}-square`}>
            <rect {...squareBox(target, orientation)} />
          </clipPath>
        ))}

        <g
          clipPath={`url(#${idPrefix}-passing)`}
          fillOpacity={rays.straightRayOpacityDecay}
        >
          {moves.map(({ target, d }) => (
            <path
              key={target}
              d={d}
              className="attack-area attack-knight-area"
            />
          ))}
        </g>
        {moves.map(({ target, d }) => (
          <g key={target} clipPath={`url(#${idPrefix}-${target}-square)`}>
            <path d={d} className="attack-area attack-knight-area" />
          </g>
        ))}
      </g>
    );
  }
  // Only the first diagonal shows where its wedges set off from.

  // What the ring is cut to on each square, and whatever the gamma tails add.
  const sectorRadius = outer + SQUARE_SIZE;
  const cuts: {
    key: string;
    d?: string;
    box?: ReturnType<typeof squareBox>;
    /** Where a rounded end's half-disc is centred, one for each end. */
    caps?: [{ x: number; y: number }, { x: number; y: number }];
  }[] = [];
  const tails: { key: string; shape: ReactElement }[] = [];


  for (const target of targets) {
    const box = squareBox(target, orientation);
    const sides = targetSides(piece.square, target, orientation);
    if (sides === null) {
      continue;
    }

    /*
      Every geometry cuts the arc radially where it leaves by `d`, on the ray
      out to where the outer circle meets that side — the ray Gamma 1's stripe
      is anchored to as well, so arc and stripe meet there without a seam. Left
      to the square, the arc runs on past `d` and comes to a spur of its own
      beside the real one.
    */
    {
      /*
        A round end reaches further round the ring than a radial cut does at
        the same angle — a half-disc where the cut is a straight line — so the
        two ends are found by different questions, each asking how far its own
        shape may go without leaving the square.
      */
      const span =
        gamma === "rounded-arc"
          ? ringCapSpanInsideRect(center, midRadius, thickness / 2, box)
          : ringSectorInsideRect(center, inner, outer, box);
      if (span !== null) {
        /*
          Each diagonal brings the arc's far end in to meet its own stripe: the
          first towards `b`, on the radius out to the corner `c` and `b` make;
          the second on the far side of the stripe rising to meet it there.
        */
        const cut =
          gamma === "gamma-1"
            ? spanFromCorner(center, sides, outer, thickness, span)
            : gamma === "gamma-2"
              ? spanToStripe(center, sides, outer, thickness, span)
              : span;
        /* The two half-discs that round the ends off, as whole discs: the half
           that falls outside the wedge is the cap, and the half inside it is
           already covered by the wedge. Where the ring is drawn in two bands
           the gap runs through them as it runs through everything else. */
        const capAt = (angle: number) => ({
          x: center.x + midRadius * Math.cos(angle),
          y: center.y + midRadius * Math.sin(angle),
        });
        cuts.push({
          key: target,
          d: sectorPath(center, cut[0], cut[1], sectorRadius),
          caps:
            gamma === "rounded-arc" ? [capAt(cut[0]), capAt(cut[1])] : undefined,
        });
      }
    }

    if (gamma === "arc" || gamma === "rounded-arc") {
      continue;
    }
    {
      /*
        Both diagonals hang a stripe off the ring; they differ in which side of
        the square it comes in by. The first leans in from `d`, above the arc,
        and is capped by the ring's outer edge. The second comes up from the
        corner by `b`, beneath the arc, and stops on the ring's inner edge —
        so one reaches the ring from outside and the other from within.
      */
      const wedge =
        gamma === "gamma-1"
          ? diagonalGammaSector(center, sides, outer, thickness)
          : diagonalTailFromB(center, sides, outer, thickness);
      if (wedge !== null) {
        const area = (
          <path d={wedge.path} className="attack-area attack-knight-area" />
        );
        tails.push({
          key: target,
          shape: (
            <g clipPath={`url(#${idPrefix}-${target}-square)`}>
              <g clipPath={`url(#${idPrefix}-cap)`}>{area}</g>
            </g>
          ),
        });
      }
    }
  }

  /*
    One figure per corner of the knight's own square, rather than one stub per
    square it attacks.

    Two of the knight's eight moves set off towards each corner, and their
    wedges leave a sliver of board between them. Filling from the outer edge of
    one to the outer edge of the other gives a single figure, bounded by the
    large inner square behind and by the square's own two sides at the corner.

    Both wedges are worked out whether or not their move stays on the board, so
    a corner is drawn the same shape wherever the knight stands; only whether it
    is drawn at all depends on the board, and one surviving move is enough. The
    move that ran off the edge still says where the figure ends.

    Angles inside one corner never straddle the wrap at ±π, so the outermost
    pair are simply the smallest and the largest.
  */
  if (cuts.length === 0) {
    return null;
  }

  return (
    <g>
      <clipPath id={clipId}>
        {cuts.map(({ key, d, box, caps }) => {
          if (d === undefined) {
            return <rect key={key} {...box} />;
          }
          if (caps === undefined) {
            return <path key={key} d={d} />;
          }
          /* Clip shapes are taken together, so the wedge and the two discs at
             its ends make one region between them. */
          return (
            <Fragment key={key}>
              <path d={d} />
              {caps.map((cap, index) => (
                <circle
                  key={index}
                  cx={cap.x}
                  cy={cap.y}
                  r={thickness / 2}
                />
              ))}
            </Fragment>
          );
        })}
      </clipPath>
      {(gamma === "gamma-1" || gamma === "gamma-2") && (
        <>
          <clipPath id={`${idPrefix}-cap`}>
            {/*
              Where the stripe stops. The first diagonal's comes down from
              outside and stops at the ring's outer edge; the second's rises
              from within and is taken to the middle of the ring rather than to
              its inner edge — the arc covers it there, where two shapes merely
              meeting would show a hairline between them however exactly they
              were placed.
            */}
            <circle
              cx={center.x}
              cy={center.y}
              r={gamma === "gamma-2" ? midRadius : outer}
            />
          </clipPath>
          {targets.map((target) => (
            <clipPath key={target} id={`${idPrefix}-${target}-square`}>
              <rect {...squareBox(target, orientation)} />
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
