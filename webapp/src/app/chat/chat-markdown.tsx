"use client";

import { Check, Copy } from "lucide-react";
import Image from "next/image";
import { type ComponentProps, memo, useCallback, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { cn } from "~/lib/cn";

/**
 * Streaming-safe Markdown renderer for assistant messages.
 * - `memo` keyed on `content` to keep streaming re-renders cheap.
 * - `skipHtml` blocks raw HTML from the model (XSS hardening).
 * - Links always open externally with rel=noreferrer noopener.
 */
export const ChatMarkdown = memo(function ChatMarkdown({
  className,
  content,
}: {
  className?: string;
  content: string;
}) {
  return (
    <div
      className={cn(
        "chat-md break-words text-inherit",
        "[&_p]:my-1 [&_p]:leading-relaxed",
        `
          [&_ol]:ml-5 [&_ol]:list-decimal
          [&_ul]:ml-5 [&_ul]:list-disc
        `,
        "[&_li]:my-0.5",
        "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_h1]:mt-2 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_hr]:border-border/50",
        `
          [&_blockquote]:border-l-2 [&_blockquote]:border-border/60
          [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground
        `,
        `
          [&_code]:rounded-md [&_code]:bg-background/60 [&_code]:px-1
          [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]
        `,
        "[&_pre]:my-0 [&_pre]:bg-transparent [&_pre]:p-0",
        "[&_pre_code]:block [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_table]:w-full [&_table]:text-xs",
        `
          [&_th]:border [&_th]:border-border/40 [&_th]:bg-muted/40 [&_th]:px-2
          [&_th]:py-1 [&_th]:text-left
        `,
        "[&_td]:border [&_td]:border-border/40 [&_td]:px-2 [&_td]:py-1",
        className,
      )}
    >
      <ReactMarkdown
        components={{
          a: ({ children, href, ...rest }) => (
            <a href={href} rel="noreferrer noopener" target="_blank" {...rest}>
              {children}
            </a>
          ),
          code: CodeBlock,
          img: ({ alt, src }) => {
            if (typeof src !== "string" || !src) return null;
            return (
              <Image
                alt={alt ?? ""}
                className="my-2 max-h-52 max-w-full rounded-lg object-contain"
                height={208}
                src={src}
                unoptimized
                width={416}
              />
            );
          },
        }}
        rehypePlugins={[
          [rehypeHighlight, { detect: true, ignoreMissing: true }],
        ]}
        remarkPlugins={[remarkGfm]}
        skipHtml
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

type CodeProps = ComponentProps<"code"> & { inline?: boolean };

function CodeBlock({ children, className, inline, ...rest }: CodeProps) {
  const text = extractTextFromChildren(children);
  const isBlock = !inline && text.includes("\n");
  if (!isBlock) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }
  const lang = /language-([\w-]+)/.exec(className ?? "")?.[1] ?? "";
  return (
    <div
      className={`
        my-2 overflow-hidden rounded-lg border border-border/40 bg-background/60
      `}
    >
      <div
        className={`
          flex items-center justify-between border-b border-border/40
          bg-muted/40 px-2 py-1 text-[10px] tracking-wide text-muted-foreground
          uppercase
        `}
      >
        <span>{lang || "code"}</span>
        <CopyButton text={text} />
      </div>
      <pre className="overflow-x-auto p-3 text-xs">
        <code className={className} {...rest}>
          {children}
        </code>
      </pre>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1200);
      } catch {
        /* ignore */
      }
    })();
  }, [text]);
  return (
    <button
      aria-label="Copy code"
      className={`
        flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px]
        text-muted-foreground
        hover:text-foreground
      `}
      onClick={copy}
      type="button"
    >
      {copied ? (
        <>
          <Check aria-hidden className="h-3 w-3" />
          Copied
        </>
      ) : (
        <>
          <Copy aria-hidden className="h-3 w-3" />
          Copy
        </>
      )}
    </button>
  );
}

function extractTextFromChildren(children: unknown): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children))
    return children.map(extractTextFromChildren).join("");
  if (children && typeof children === "object" && "props" in children) {
    const props = (children as { props?: { children?: unknown } }).props;
    return extractTextFromChildren(props?.children);
  }
  return "";
}
