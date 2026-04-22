"use client";

import { ImageIcon, Mic, Square } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";

/**
 * Fixed-bottom chat composer. Owns:
 * - auto-growing textarea
 * - image picker (with type + size validation handled by parent callback)
 * - speech dictation
 * - submit (Enter) / newline (Shift+Enter)
 * - stop-streaming button while the model is responding
 */
export function ChatComposer({
  busy,
  input,
  onImagePicked,
  onInputChange,
  onStartSpeech,
  onStop,
  onSubmit,
}: {
  busy: boolean;
  input: string;
  onImagePicked: (files: FileList) => void;
  onInputChange: (next: string) => void;
  onStartSpeech: () => void;
  onStop: () => void;
  onSubmit: (text: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [autoGrow, input]);

  const submitIfNotEmpty = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    onSubmit(text);
  }, [input, onSubmit]);

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitIfNotEmpty();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitIfNotEmpty();
    }
  };

  return (
    <div
      className={`
        shrink-0 border-t border-border/80 bg-background/95 p-4 backdrop-blur
        supports-[backdrop-filter]:bg-background/80
      `}
    >
      <div className="mx-auto w-full max-w-3xl">
        <input
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          multiple
          onChange={(e) => {
            const files = e.target.files;
            e.target.value = "";
            if (files?.length) onImagePicked(files);
          }}
          ref={fileInputRef}
          type="file"
        />
        <form
          aria-label="Send a message"
          className="rounded-2xl border border-border/80 bg-muted/30 p-2"
          onSubmit={onFormSubmit}
        >
          <label className="sr-only" htmlFor="chat-input">
            Message
          </label>
          <textarea
            aria-label="Message"
            className={cn(
              "border-input bg-transparent",
              "placeholder:text-muted-foreground",
              "max-h-60 min-h-[48px] w-full resize-none px-3 py-2 text-sm",
              "rounded-xl border-0 border-transparent",
              `
                ring-0 outline-none
                focus:ring-0
                focus-visible:ring-0 focus-visible:outline-none
              `,
            )}
            disabled={busy}
            id="chat-input"
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Send a private message…"
            ref={textareaRef}
            rows={2}
            value={input}
          />
          <div className="flex items-center justify-between gap-2 px-1 pb-1">
            <div className="flex items-center gap-1">
              <Button
                disabled={busy}
                onClick={onStartSpeech}
                size="icon"
                title="Dictate"
                type="button"
                variant="ghost"
              >
                <Mic aria-hidden className="h-4 w-4" />
              </Button>
              <Button
                disabled={busy}
                onClick={() => fileInputRef.current?.click()}
                size="icon"
                title="Attach image"
                type="button"
                variant="ghost"
              >
                <ImageIcon aria-hidden className="h-4 w-4" />
              </Button>
              {busy ? (
                <Button
                  onClick={onStop}
                  size="sm"
                  type="button"
                  variant="destructive"
                >
                  <Square aria-hidden className="mr-1 h-3.5 w-3.5" />
                  Stop
                </Button>
              ) : null}
            </div>
            <Button disabled={busy || !input.trim()} size="sm" type="submit">
              Send
            </Button>
          </div>
        </form>
        <p
          className={`mt-1.5 px-1 text-[11px] text-muted-foreground select-none`}
        >
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
