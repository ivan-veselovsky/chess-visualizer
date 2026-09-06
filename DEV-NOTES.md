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



