"use client";

import { Mail, Send } from "lucide-react";

const X_ICON = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden
  >
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

interface ProductShareProps {
  url: string;
  title: string;
  className?: string;
}

export function ProductShare({ url, title, className }: ProductShareProps) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedBody = encodeURIComponent(`${title}\n${url}`);

  const xUrl = `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`;
  const telegramUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
  const mailtoUrl = `mailto:?subject=${encodedTitle}&body=${encodedBody}`;

  return (
    <div className={className}>
      <span className="mr-2 text-sm font-medium text-muted-foreground">Share:</span>
      <div className="inline-flex items-center gap-2">
        <a
          href={xUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Share on X (Twitter)"
        >
          {X_ICON}
        </a>
        <a
          href={telegramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Share on Telegram"
        >
          <Send className="h-4 w-4" />
        </a>
        <a
          href={mailtoUrl}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Share via Email"
        >
          <Mail className="h-4 w-4" />
        </a>
      </div>
    </div>
  );
}
