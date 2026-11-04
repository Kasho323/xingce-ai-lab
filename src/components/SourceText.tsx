import { Fragment } from "react";
/** Render text and allowlisted local images only. Source HTML is never executed. */
export function SourceText({
  text,
  highlights = [],
}: {
  text: string;
  highlights?: string[];
}) {
  function highlight(s: string) {
    const terms = highlights.filter(Boolean);
    if (!terms.length) return s;
    const pattern = terms
      .map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|");
    return s
      .split(new RegExp(`(${pattern})`, "g"))
      .map((x, i) => (terms.includes(x) ? <mark key={i}>{x}</mark> : x));
  }
  return (
    <span className="source-text">
      {text.split(/(\[\[asset:[a-zA-Z0-9_-]+\.png\]\])/g).map((part, i) => {
        const match = /^\[\[asset:([a-zA-Z0-9_-]+\.png)\]\]$/.exec(part);
        return match ? (
          <img
            key={i}
            src={`/api/study/asset/${match[1]}`}
            alt="来源中的原始图形或公式"
            loading="lazy"
          />
        ) : (
          <Fragment key={i}>{highlight(part)}</Fragment>
        );
      })}
    </span>
  );
}
