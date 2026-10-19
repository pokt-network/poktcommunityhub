import { cn } from "@/lib/utils";

type Block =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

function stripInlineMarkdown(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/, "")
    .trim();
}

function parseBullet(line: string) {
  const m = line.match(/^\s*[-*•]\s+(.+)$/);
  return m ? stripInlineMarkdown(m[1]) : null;
}

function parseNumbered(line: string) {
  const m = line.match(/^\s*\d+[.)]\s+(.+)$/);
  return m ? stripInlineMarkdown(m[1]) : null;
}

/** Turn ChatGPT / plain multi-line quest copy into readable blocks. */
export function parseQuestDescription(raw: string): Block[] {
  const lines = raw.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let bullets: string[] | null = null;
  let numbered: string[] | null = null;

  const flushPara = () => {
    if (!para.length) return;
    const text = stripInlineMarkdown(para.join(" ").replace(/\s+/g, " "));
    if (text) blocks.push({ type: "p", text });
    para = [];
  };

  const flushLists = () => {
    if (bullets?.length) blocks.push({ type: "ul", items: bullets });
    if (numbered?.length) blocks.push({ type: "ol", items: numbered });
    bullets = null;
    numbered = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      flushPara();
      flushLists();
      continue;
    }

    const bullet = parseBullet(line);
    if (bullet) {
      flushPara();
      if (numbered) {
        blocks.push({ type: "ol", items: numbered });
        numbered = null;
      }
      bullets = bullets ?? [];
      bullets.push(bullet);
      continue;
    }

    const num = parseNumbered(line);
    if (num) {
      flushPara();
      if (bullets) {
        blocks.push({ type: "ul", items: bullets });
        bullets = null;
      }
      numbered = numbered ?? [];
      numbered.push(num);
      continue;
    }

    flushLists();
    para.push(line.trim());
  }

  flushPara();
  flushLists();
  return blocks;
}

export function QuestDescription({
  text,
  className,
  compact = false,
}: {
  text: string;
  className?: string;
  /** Single-line clamp preview for cards. */
  compact?: boolean;
}) {
  const cleaned = text.trim();
  if (!cleaned) {
    return <p className={cn("text-sm text-muted", className)}>No description.</p>;
  }

  if (compact) {
    const preview = cleaned
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((l) => l.replace(/^\s*[-*•]\s+/, "").replace(/^\s*\d+[.)]\s+/, "").trim())
      .filter(Boolean)
      .join(" · ");
    return (
      <p className={cn("line-clamp-2 text-sm text-muted", className)}>
        {stripInlineMarkdown(preview) || "No description."}
      </p>
    );
  }

  const blocks = parseQuestDescription(cleaned);
  if (!blocks.length) {
    return (
      <p className={cn("whitespace-pre-wrap text-sm leading-relaxed text-muted", className)}>
        {cleaned}
      </p>
    );
  }

  return (
    <div className={cn("space-y-3 text-sm leading-relaxed text-muted", className)}>
      {blocks.map((block, i) => {
        if (block.type === "p") {
          return (
            <p key={i} className="whitespace-pre-wrap">
              {block.text}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="list-disc space-y-1.5 pl-5 marker:text-[#8eb6ff]">
              {block.items.map((item, j) => (
                <li key={j} className="pl-0.5">
                  {item}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <ol key={i} className="list-decimal space-y-1.5 pl-5 marker:text-[#8eb6ff]">
            {block.items.map((item, j) => (
              <li key={j} className="pl-0.5">
                {item}
              </li>
            ))}
          </ol>
        );
      })}
    </div>
  );
}
