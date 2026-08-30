# Chess Visualizer

## Blunder less. See the board. Spot the threats. 

Love chess but hate missing the obvious?

**Put your right brain to work alongside your left.** Chess Visualizer reveals the structure of a position at a glance: critical, weak, and contested squares—and how pieces attack, support, and constrain one another.

### Features

- **Attack rays** — see exactly which squares every piece attacks.

  ![Attack rays](img/attack-rays.png)

- **Attack heatmap** — color-shaded squares by attacking side and pressure intensity.

  ![Attack heatmap](img/attack-heatmap.png)

- **Fully customizable visualization** — configure every color and nearly every aspect of the visualization geometry.

- **It takes two to tango** — play online with a friend, no sign-up; resume a game, take up an unfinished one from a PGN, play with odds, and allow takebacks.

- **Classic games and PGN / FEN support** — explore famous games from the built-in library, import and export games and positions in PGN / FEN format.

- **And plenty more** — share a position or a game as a link, read the material balance off the captured-pieces bar, and put a game aside in the stash while you look at another.

[Try Chess Visualizer online](https://chess-visualizer.ivan-a87.workers.dev).

Chess Visualizer is open source and released under the [MIT License](LICENSE).

Give it a try, share your thoughts, and enjoy the game!

Like this project? You can [♥$ support](https://github.com/sponsors/ivan-veselovsky) the developer.

## More screenshots

Adolf Anderssen - Jean Dufresne - 1852
![Adolf Anderssen - Jean Dufresne - 1852](img/image-01.png)

Richard Reti - Jose Raul Capablanca - 1924
![Richard Reti - Jose Raul Capablanca - 1924](img/image-02.png)

## Development

    npm install
    npm run dev        # the visualizer alone
    npm run build && npx wrangler dev   # ...with the two-player server
    npm test           # unit tests;  ./test-local.sh runs the protocol suites