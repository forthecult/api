"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function LpMarkdownBody({ markdown }: { markdown: string }) {
  return (
    <div
      className={`
        prose prose-neutral max-w-none
        dark:prose-invert
        prose-headings:font-heading
        prose-p:text-muted-foreground
        prose-a:text-primary
      `}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </div>
  );
}
