# Backlog

Open questions and deferred work. Each entry says what was seen, what is known
about it, and what a fix would cost — enough to pick up cold.

## Open questions

### The two balance choosers disagree about their own right corner

**Seen.** With both maxima set to the same number (0.75), the two diamonds on
the Balance tab show noticeably different colour distributions. The heatmap's is
symmetric about its horizontal diagonal; the rays' leans towards the opponent
almost everywhere.

**Measured.** How far each field leans towards my colour, 1 being wholly mine
and 0 wholly the opponent's:

| point | rays | heatmap |
| --- | --- | --- |
| me 1, opponent 0 | 0.83 | 0.83 |
| me 0, opponent 1 | 0.16 | 0.16 |
| **me 1, opponent 1** | **0.22** | **0.50** |
| me 1, opponent 0.5 | 0.54 | 0.58 |
| me 0.5, opponent 1 | 0.18 | 0.42 |

The corners agree. At the right corner, where the two sides are equally full,
the rays field reads 0.22 rather than 0.50. Swapping the two sides ought to
mirror the colour: for the heatmap that test comes out at exactly 1.00, for the
rays at 0.72.

**Why.** The two fields are computed differently, in `intensityField.ts`:

```
rays:     over( over(board, mine, x·max), theirs, y·max )          two layers, stacked
heatmap:  over( board, mix(mine, theirs, x/(x+y)), 1−(1−x)(1−y) )  one blend, one wash
```

Alpha compositing is not commutative. Painting mine and then the opponent's over
it leaves the opponent contributing its full share and mine only what the
opponent's transparency lets through — at 0.75 each, 0.75 against 0.19. The
heatmap weighs the two hues against each other first, which is symmetric, and
washes the result once, so order never enters.

**The judgement.** The rays field is truthful about one stacking order, and
"mine underneath" was chosen when it was written. On the board the order follows
the order the pieces are drawn in, so both orders occur there and neither is the
truth of it.

**A fix, if wanted.** Average the two orders. It stays alpha compositing rather
than borrowing the heatmap's model, it is symmetric — so the two diamonds stop
disagreeing about a point where the two sides are equal — and it represents the
board's actual mixture better than either order alone:

```ts
const under = over(over(board, mine, x), theirs, y);
const above = over(over(board, theirs, y), mine, x);
return under.map((c, i) => (c + above[i]) / 2);
```

**Related, and deliberately unfixed.** Two rays overlapping on the board are
composited by the browser in sRGB, while the heatmap blends its two hues in
linear light. Matching them would mean running the whole attack layer through a
filter with `color-interpolation-filters="linearRGB"`, at a filter's cost per
piece — and the two are not the same operation anyway: `mix` averages two opaque
colours, while overlapping rays are a stack of translucent ones, whose result
depends on their order.


TODO: 

1. ~~In Match tab, it is possible to see the following:~~ **Done.**
![alt text](image.png) 
   -- a game of same id mentioned twice.

   Not two records of one seat: two seats at one game. A browser can sit at both
   ends — `seatOf` writes `-<id>` for the side that offered the game and `<id>`
   for the side that took it up — so both rows were true, each from its own
   side, and neither said which side that was. The names were already on the
   records; the list was not showing them. It now reads
   `829 115 739  Bob (you) – Alice  — You lost by resignation.`, which is also
   how a PGN names them.

   
2. Separate takebacks for me and the opponent.

3. Time control in the game: 1st step: clock for each of the players on the top and bottom of the board in play mode.

4. 