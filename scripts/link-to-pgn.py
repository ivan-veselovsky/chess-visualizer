#!/usr/bin/env python3
"""
The PGN a shared game link carries, from a link read on standard input.

    python3 scripts/link-to-pgn.py < link.txt
    echo 'https://…/?gameBase64=W1NldFVw…&autoplay=true' | python3 scripts/link-to-pgn.py

Whatever the link is pasted as is taken: the whole address, the query alone,
or only the encoded game. Line breaks and spaces in it are dropped, so a link
that came wrapped over several lines reads as one. Parameters a site adds on
the way — Facebook's `fbclid` — are passed over.

A link says the game one of two ways, and both are read:

  - `gameBase64`, what "Share game" writes now: the PGN as UTF-8, in URL-safe
    base64 (`-` and `_` for `+` and `/`) without its `=` padding — which is
    why `base64 -d` decodes it and then calls it invalid;
  - `game`, what links said before: the PGN as text, percent-encoded.

The PGN goes to standard output; anything that is not a game link is said on
standard error, with a status of 1.
"""

import base64
import binascii
import re
import sys
from urllib.parse import parse_qs, urlsplit


def decode_base64url(encoded: str) -> str:
    """URL-safe or plain base64, padded or not, to the UTF-8 text it holds."""
    plain = encoded.replace("-", "+").replace("_", "/").rstrip("=")
    if not re.fullmatch(r"[A-Za-z0-9+/]*", plain) or len(plain) % 4 == 1:
        raise ValueError("not base64")
    data = base64.b64decode(plain + "=" * (-len(plain) % 4), validate=True)
    return data.decode("utf-8")


def pgn_of(text: str) -> str:
    link = re.sub(r"\s+", "", text)
    if link == "":
        raise ValueError("nothing was read")
    # An address, or a query with or without its "?": the parameters. A bare
    # value has no "=" outside its padding, and is the game itself.
    query = urlsplit(link).query if "?" in link else link
    asked = parse_qs(query, keep_blank_values=True)
    if "gameBase64" in asked:
        return decode_base64url(asked["gameBase64"][0])
    if "game" in asked:
        return asked["game"][0]
    if "position" in asked:
        raise ValueError("that link is a position, not a game: " + asked["position"][0])
    return decode_base64url(link)


def main() -> None:
    try:
        pgn = pgn_of(sys.stdin.read())
    except (ValueError, binascii.Error, UnicodeDecodeError) as trouble:
        sys.exit(f"link-to-pgn: no game in that link ({trouble})")
    sys.stdout.write(pgn if pgn.endswith("\n") else pgn + "\n")


if __name__ == "__main__":
    main()
