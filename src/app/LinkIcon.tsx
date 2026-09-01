/** A chain, whole or parted, for the button that holds the two intensity
 *  choosers equal. */
export default function LinkIcon({ closed }: { closed: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.4em"
      height="1.4em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M9.5 7.5H7a4.5 4.5 0 0 0 0 9h2.5" />
      <path d="M14.5 7.5H17a4.5 4.5 0 0 1 0 9h-2.5" />
      {closed ? (
        <path d="M8 12h8" />
      ) : (
        <>
          <path d="M8 12h1.6" />
          <path d="M14.4 12H16" />
        </>
      )}
    </svg>
  );
}
