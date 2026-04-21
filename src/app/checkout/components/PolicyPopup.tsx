"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/ui/primitives/dialog";

interface PolicyPopupProps {
  children: React.ReactNode;
  /** Plain-text content (legacy). Prefer richContent for formatted policies. */
  content?: string;
  /** If set, shows a "Read full policy" link that opens in a new tab. */
  fullPolicyHref?: string;
  /** Rich JSX content for formatted policy display. Takes precedence over content. */
  richContent?: React.ReactNode;
  title: string;
}

export function PolicyPopup({
  children,
  content,
  fullPolicyHref,
  richContent,
  title,
}: PolicyPopupProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          className={`
            text-primary
            hover:underline
          `}
          type="button"
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {richContent ? (
            <div className="text-sm text-foreground">{richContent}</div>
          ) : content ? (
            <p className="text-sm whitespace-pre-line text-foreground">
              {content}
            </p>
          ) : null}
          {fullPolicyHref ? (
            <p className="text-sm">
              <a
                className={`
                  font-medium text-primary underline-offset-4
                  hover:underline
                `}
                href={fullPolicyHref}
                rel="noopener noreferrer"
                target="_blank"
              >
                Read full policy
              </a>
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
