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
  content?: string;
  /** If set, shows a "Read full policy" link that opens in a new tab. */
  fullPolicyHref?: string;
  children: React.ReactNode;
}

export function PolicyPopup({
  title,
  content,
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
          {content ? (
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
              <span className="text-muted-foreground"></span>
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
