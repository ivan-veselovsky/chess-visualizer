interface SectionRuleProps {
  /** What the section below it is about, in a word or two. */
  name: string;
}

/**
 * The line between two groups of settings, with the name of the group it opens.
 *
 * A rule alone says only "these are apart"; named, it says what they are apart
 * *as* — which matters most where two groups do similar things, a grid of lines
 * over the squares and a hatching of them being the case that prompted this.
 *
 * The name sits near the left, with a short stub of rule before it and the rest
 * running out to the edge: the line reads as one line that the word is set into
 * rather than as a word with a line after it, and the stub ties it to the
 * panel's left edge the way the fields below it are tied.
 */
export default function SectionRule({ name }: SectionRuleProps) {
  return (
    <div className="section-rule">
      <hr className="panel-divider section-rule-lead" />
      <span className="section-rule-name">{name}</span>
      <hr className="panel-divider" />
    </div>
  );
}
