import { chess } from "../chess/position";
import Board from "../visualization/Board";

export default function App() {
  return (
    <main className="app">
      <h1>Chess Visualizer</h1>
      <Board position={chess} />
      <p className="fen">{chess.fen()}</p>
    </main>
  );
}
