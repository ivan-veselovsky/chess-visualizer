/** The heartbeat, and each player being told whether the other is there. */
import { connect, settle, answered, until, token, gameId, check, summary } from "./lib.mjs";
import { answerTo } from "../protocol.ts";

console.log("Who is on the line\n");

const PING = '{"type":"ping"}';

/** A game with both players connected, each having heard nothing yet. */
async function paired() {
  const game = gameId(), hostToken = token(), guestToken = token();
  const host = await connect(game, "host");
  host.say({ type: "create", token: hostToken, name: "Bob", color: "w" });
  await answered(host);
  const guest = await connect(game, "guest");
  guest.say({ type: "answer", token: guestToken, name: "Alice", accept: true });
  // Both are coupled once each has been told so, which is when the pair is
  // ready to be tested rather than merely asked for.
  await until(guest, "presence");
  await until(host, "presence");
  return { game, host, guest, hostToken, guestToken };
}

// The runtime answers this one; the object never sees it.
{
  const game = gameId(), lonely = await connect(game, "pinger");
  lonely.send(PING);
  await until(lonely, "pong");
  check("a ping is answered",
    lonely.heard.some((m) => m.type === "pong"), JSON.stringify(lonely.heard));
  check("and answering it did not disturb the game",
    !lonely.heard.some((m) => m.type === "error"), JSON.stringify(lonely.heard));
  lonely.close();
}

// Arriving lights the other player's lamp.
{
  const { host, guest } = await paired();
  const told = host.heard.filter((m) => m.type === "presence");
  check("the challenger is told when the answerer arrives",
    told.at(-1)?.opponent === true, JSON.stringify(told));
  check("and the answerer is told the challenger is there",
    guest.heard.filter((m) => m.type === "presence").at(-1)?.opponent === true,
    JSON.stringify(guest.heard.filter((m) => m.type === "presence")));
  host.close(); guest.close();
}

// Going away puts it out, without either of them asking.
{
  const { host, guest } = await paired();
  host.heard.length = 0;
  guest.close();
  await until(host, "presence");
  check("the one left behind is told the other has gone",
    host.heard.filter((m) => m.type === "presence").at(-1)?.opponent === false,
    JSON.stringify(host.heard));
  host.close();
}

// And coming back lights it again.
{
  const { game, host, guest, guestToken } = await paired();
  /*
    Cleared before each wait, not after. A wait for "a presence message" is
    answered by any that is already there, and coupling the two players sent
    one — so without this it would be the arrival being waited for a second
    time rather than the departure.
  */
  host.heard.length = 0;
  guest.close();
  await until(host, "presence");
  host.heard.length = 0;
  const again = await connect(game, "guest returning");
  again.say({ type: "resume", token: guestToken });
  await until(host, "presence");
  check("and told again when they come back",
    host.heard.filter((m) => m.type === "presence").at(-1)?.opponent === true,
    JSON.stringify(host.heard));
  host.close(); again.close();
}

// A second window of the same player is one player, still there.
{
  const { game, host, guest, guestToken } = await paired();
  const second = await connect(game, "guest's other tab");
  second.say({ type: "resume", token: guestToken });
  await until(second, "state");
  host.heard.length = 0;
  second.close();
  // Nothing should change, so there is nothing to wait for: a flat pause is
  // the only way to ask whether something did not happen.
  await settle();
  check("closing one of a player's two windows leaves them present",
    host.heard.filter((m) => m.type === "presence").at(-1)?.opponent !== false,
    JSON.stringify(host.heard));
  host.close(); guest.close();
}

// A stranger looking on is not a player arriving.
{
  const { game, host, guest } = await paired();
  host.heard.length = 0;
  const looker = await connect(game, "passer-by");
  looker.say({ type: "peek" });
  await answered(looker);
  looker.close();
  await settle();
  check("somebody looking in changes nothing about who is playing",
    host.heard.filter((m) => m.type === "presence").every((m) => m.opponent === true),
    JSON.stringify(host.heard));
  host.close(); guest.close();
}

/*
  A question carried to the other player and answered by them.

  This is the check the lights are actually drawn from. The object relays it
  and never answers it, so a reply proves that somebody's code read the
  question and worked out what to send back — which a socket left open by a
  tab that has gone cannot do.
*/
{
  const { host, guest, hostToken, guestToken } = await paired();
  host.heard.length = 0;
  guest.heard.length = 0;

  host.say({ type: "probe", token: hostToken, text: "abc123xy" });
  await until(guest, "probe");
  check("a question is carried to the other player, untouched",
    guest.heard.at(-1)?.type === "probe" && guest.heard.at(-1).text === "abc123xy",
    JSON.stringify(guest.heard.at(-1)));
  check("and the object does not answer it itself",
    !host.heard.some((m) => m.type === "probed"), JSON.stringify(host.heard));

  guest.say({ type: "probed", token: guestToken, text: answerTo("abc123xy") });
  await until(host, "probed");
  check("their answer comes back to whoever asked",
    host.heard.at(-1)?.type === "probed" && host.heard.at(-1).text === "yx321cba",
    JSON.stringify(host.heard.at(-1)));
  host.close(); guest.close();
}

// A question with nobody to carry it to is simply not carried.
{
  const game = gameId(), host = token();
  const alone = await connect(game, "alone");
  alone.say({ type: "create", token: host, name: "Bob", color: "w" });
  await answered(alone);
  alone.heard.length = 0;
  alone.say({ type: "probe", token: host, text: "nobodyhome" });
  // Again nothing is expected, so again there is only the pause.
  await settle();
  check("a question with no opponent to hear it is dropped, not refused",
    alone.heard.length === 0 && alone.closed === null,
    JSON.stringify(alone.heard));
  alone.close();
}

// And a stranger cannot use the object as a way to reach the players.
{
  const { host, guest } = await paired();
  guest.heard.length = 0;
  const outsider = await connect(gameId(), "outsider");
  outsider.say({ type: "probe", token: token(), text: "letmein12" });
  await answered(outsider);
  check("a probe from a token the game does not know is refused",
    outsider.heard[0]?.code === "unknownToken", JSON.stringify(outsider.heard[0]));
  check("and nothing reached the players",
    guest.heard.every((m) => m.type !== "probe"), JSON.stringify(guest.heard));
  host.close(); guest.close(); outsider.close();
}

process.exit(summary() ? 0 : 1);
