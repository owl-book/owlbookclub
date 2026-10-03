import { Fragment } from "react";
import { parseRichText } from "@/lib/rich-text";

// 책방이 적은 글을 문단·점 목록·번호 목록으로 보여 준다. 줄바꿈은 그대로 살린다.
export function RichText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`space-y-3 break-keep ${className}`}>
      {parseRichText(text).map((b, i) =>
        b.type === "p" ? (
          <p key={i}>
            <Lines lines={b.lines} />
          </p>
        ) : b.type === "ul" ? (
          <ul key={i} className="list-disc space-y-1 pl-5 marker:text-ink-3">
            {b.items.map((lines, j) => (
              <li key={j} className="pl-0.5">
                <Lines lines={lines} />
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i} start={b.start} className="list-decimal space-y-1 pl-6 marker:text-ink-3">
            {b.items.map((lines, j) => (
              <li key={j} className="pl-0.5">
                <Lines lines={lines} />
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}

function Lines({ lines }: { lines: string[] }) {
  return lines.map((l, i) => (
    <Fragment key={i}>
      {i > 0 && <br />}
      {l}
    </Fragment>
  ));
}
