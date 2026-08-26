import { useEffect, useRef, useState } from "react";

interface CopyButtonProps {
  label: string;
  /** Built when pressed, so nothing is assembled until it is wanted. */
  text: () => string | null;
  title?: string;
  disabled?: boolean;
}

/**
 * A button that puts something on the clipboard and says so for a moment.
 *
 * It reports failure as well: the clipboard is refused outside a secure
 * context and can be denied outright, and a button that looks like it worked
 * when it did not is worse than one that admits it.
 */
export default function CopyButton({
  label,
  text,
  title,
  disabled = false,
}: CopyButtonProps) {
  const [said, setSaid] = useState<"copied" | "failed" | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
      }
    },
    [],
  );

  async function copy() {
    const value = text();
    if (value === null) {
      return;
    }
    let outcome: "copied" | "failed" = "copied";
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      outcome = "failed";
    }
    setSaid(outcome);
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => setSaid(null), 1600);
  }

  return (
    <button
      type="button"
      className="reset-button"
      title={title}
      disabled={disabled}
      onClick={copy}
    >
      {said === "copied" ? "Copied" : said === "failed" ? "Copy failed" : label}
    </button>
  );
}
