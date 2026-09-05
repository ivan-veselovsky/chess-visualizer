import CopyButton from "../CopyButton";
import ShareIcon from "../ShareIcon";
import { spellGameId } from "./storage";

interface InviteDetailsProps {
  /** The game's own number, as the object knows it. */
  gameId: string;
  /** The address that opens this game in somebody else's browser. */
  link: string;
  /** Distinct per use, since two of these can be on the page at once. */
  idPrefix?: string;
}

/**
 * The two ways of handing a game to somebody: its link, and its number.
 *
 * Both, rather than one: a link is what goes into a message, and the number is
 * what can be read down a telephone or written on paper. They are the same
 * thing said twice, and which one is wanted depends on who is being told.
 */
export default function InviteDetails({
  gameId,
  link,
  idPrefix = "invite",
}: InviteDetailsProps) {
  return (
    <>
      <div className="board-controls">
        <label htmlFor={`${idPrefix}-link`}>Challenge link</label>
        <input
          id={`${idPrefix}-link`}
          type="text"
          className="fen-input"
          readOnly
          value={link}
          onFocus={(event) => event.target.select()}
        />
        <CopyButton
          label="Copy"
          icon={<ShareIcon />}
          title="Copy the challenge link"
          text={() => link}
        />
      </div>

      <div className="board-controls">
        <label htmlFor={`${idPrefix}-number`}>Game id</label>
        {/* Said aloud as often as it is pasted, so it is shown the way it
            would be read: in threes. */}
        <output id={`${idPrefix}-number`} className="invite-number">
          {spellGameId(gameId)}
        </output>
        <CopyButton label="Copy" title="Copy the game id" text={() => gameId} />
      </div>
    </>
  );
}
