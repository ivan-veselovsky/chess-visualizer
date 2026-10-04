### Server Side Logging 

GAME_LOG variable, and I've set the defaults the way round you'd want:

Off for deployments. wrangler.jsonc now carries "vars": { "GAME_LOG": "off" }, which is what a deployed worker reads. Turn it on when there's a question to answer:


npx wrangler deploy --var GAME_LOG:on
On locally. A new .dev.vars holds GAME_LOG=on, which wrangler dev reads and a deployment never sees — so a log is kept where somebody is watching and not where nobody is.

```
wrangler dev  # with logs
wrangler dev --var GAME_LOG:off  # without log
```

### Local Storage K-V

```
Object.entries(localStorage)
  .filter(([k]) => k.startsWith("cv."))
  .map(([k, v]) => [k, v.replace(/"token":"[^"]+"/, '"token":"…"')])
```

### Client Side Logging

checkbox in the Gear tab: "Enable client logging", 
```
// see it
localStorage.getItem("cv.log")          // "on" | "off" | null  (null = the default)

// turn it on / off, for this browser
localStorage.setItem("cv.log", "on")
localStorage.setItem("cv.log", "off")
localStorage.removeItem("cv.log")       // back to 
the default: on in dev, off in a build
```

The catch: writing the key does not take effect in the tab that wrote it. The log module reads the flag at startup and afterwards only listens for the storage event — which browsers fire in other tabs, never the one that made the change. Measured just now: setItem("cv.log","on") from the console produced 0 lines, and the same tab started logging (107 lines) only after being nudged.

So either reload the tab, or nudge it in place:

```
localStorage.setItem("cv.log", "on");
dispatchEvent(new StorageEvent("storage", { key: "cv.log" }))   // takes effect immediately
```

The checkbox on the gear tab has no such catch — it sets the flag and the running module in one go, and other tabs pick it up through that same event.

Once lines are flowing, type ♟ into the console's filter box to see only these.




### Piece sets

The men are drawn from a set of six SVG pictures, chosen on the Pieces tab
("Piece set"). A set is a folder under `src/pieces/`, named as the setting
shows it, holding `k.svg`, `q.svg`, `r.svg`, `b.svg`, `n.svg` and `p.svg`;
adding a folder adds a set, with nothing else to change (a folder missing any
of the six is skipped). Each picture is one silhouette in a square viewBox, the
man standing in it as he should on a square: the app tints whatever has no fill
of its own and draws the outline round it. A set made from a font's chess
glyphs:

    python3 scripts/font-glyphs-to-svg.py FONT.ttf "src/pieces/Set name"

Keep the font's licence beside the pictures, as `LICENSE.txt`.

A set whose men stand too high or too low on their squares (as a font's glyphs
can, placed by the font's own metrics) is moved as a whole by a
`meta-info.json` in its folder:

    { "correction": { "delta_x": 0, "delta_y": 0.1 } }

In sides of a square, x to the right and y down, as SVG counts: `0.1` moves
every man a tenth of a square lower. Without the file, or for a value that is
not a number, nothing is moved.

### Shared game links

"Share game" puts the PGN in the link as `gameBase64=…`: UTF-8, URL-safe base64
(`-` and `_` for `+` and `/`), without `=` padding, so `base64 -d` rejects it.
Older links say `game=…` with the PGN as text; both are read. To see what a
link carries:

    python3 scripts/link-to-pgn.py < link.txt
