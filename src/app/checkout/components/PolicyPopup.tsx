"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/ui/primitives/dialog";

interface PolicyPopupProps {
  title: string;
  /** Plain-text content (legacy). Prefer richContent for formatted policies. */
  content?: string;
  /** Rich JSX content for formatted policy display. Takes precedence over content. */
  richContent?: React.ReactNode;
  /** If set, shows a "Read full policy" link that opens in a new tab. */
  fullPolicyHref?: string;
  children: React.ReactNode;
}

export function PolicyPopup({
  title,
  content,
  richContent,
  fullPolicyHref,
  children,
}: PolicyPopupProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-primary hover:underline" type="button">
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
            <p className="whitespace-pre-line text-sm text-foreground">
              {content}
            </p>
          ) : null}
          {fullPolicyHref ? (
            <p className="text-sm">
              <a
                href={fullPolicyHref}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-4 hover:underline"
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
