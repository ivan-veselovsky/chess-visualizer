/**
 * A written colour brought to the form the rest of the app stores, or null when
 * it is not one yet.
 *
 * The leading hash is optional and the three-digit form is understood, since
 * both are things people paste.
 */
export function readHex(text: string): string | null {
  const written = text.trim().replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(written)) {
    return `#${written.toLowerCase()}`;
  }
  if (/^[0-9a-f]{3}$/i.test(written)) {
    return `#${[...written]
      .map((digit) => digit + digit)
      .join("")
      .toLowerCase()}`;
  }
  return null;
}
