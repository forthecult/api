"use client";

import {
  FileText,
  Info,
  Link2,
  Loader2,
  Paperclip,
  Trash2,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import type { ChatProject } from "~/app/chat/chat-sidebar";

import {
  type CloudProvider,
  extractKnowledgeText,
  guessProviderFromUrl,
  isKnowledgeFileAllowed,
  isValidHttpUrl,
  type ProjectKnowledgeItem,
} from "~/app/chat/project-knowledge";
import { cn } from "~/lib/cn";
import { isUrlAllowedForProjectKnowledge } from "~/lib/project-knowledge-url-policy";
import { Button } from "~/ui/primitives/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/ui/primitives/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/ui/primitives/dropdown-menu";
import { Label } from "~/ui/primitives/label";

const ACCEPT_KNOWLEDGE =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.tsv,.txt,.md,.html,.json,.xml,.rtf,.odt,.ods,.odp";

interface ProjectSettingsPanelProps {
  className?: string;
  knowledgeItems: ProjectKnowledgeItem[];
  onInstructionsChange: (instructions: string) => void;
  onKnowledgeChange: (items: ProjectKnowledgeItem[]) => void;
  project: ChatProject;
}

export function ProjectSettingsPanel({
  className,
  knowledgeItems,
  onInstructionsChange,
  onKnowledgeChange,
  project,
}: ProjectSettingsPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkProvider, setLinkProvider] = useState<CloudProvider>("google");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files?.length) return;
      setBusy(true);
      try {
        const next = [...knowledgeItems];
        for (const file of Array.from(files)) {
          if (!isKnowledgeFileAllowed(file)) {
            toast.error(
              `"${file.name}" is not an allowed knowledge type (e.g. executables are blocked).`,
            );
            continue;
          }
          let extracted;
          try {
            extracted = await extractKnowledgeText(file);
          } catch (e) {
            toast.error(
              e instanceof Error ? e.message : "Could not read this file.",
            );
            continue;
          }
          next.push({
            addedAt: Date.now(),
            id: crypto.randomUUID(),
            kind: "file",
            mimeType: file.type || "application/octet-stream",
            name: file.name,
            needsExtraction: extracted.needsExtraction,
            size: file.size,
            textContent: extracted.text,
          });
          if (extracted.needsExtraction) {
            toast.message(
              `${file.name}: stored as a reference. Add a share link for full text, or paste excerpts into instructions.`,
            );
          }
        }
        onKnowledgeChange(next);
      } finally {
        setBusy(false);
      }
    },
    [knowledgeItems, onKnowledgeChange],
  );

  const removeItem = (id: string) => {
    onKnowledgeChange(knowledgeItems.filter((x) => x.id !== id));
  };

  const openLinkDialog = (provider: CloudProvider) => {
    setLinkProvider(provider);
    setLinkUrl("");
    setLinkName("");
    setLinkOpen(true);
  };

  const submitLink = () => {
    const url = linkUrl.trim();
    if (!isValidHttpUrl(url)) {
      toast.error("Enter a valid http(s) URL to a document or folder.");
      return;
    }
    if (!isUrlAllowedForProjectKnowledge(url)) {
      toast.error(
        "That URL is blocked (localhost, private IPs, or internal hosts).",
      );
      return;
    }
    const name =
      linkName.trim() ||
      (() => {
        try {
          return new URL(url).hostname;
        } catch {
          return "Document link";
        }
      })();
    const inferred = guessProviderFromUrl(url);
    const provider = inferred !== "other" ? inferred : linkProvider;
    onKnowledgeChange([
      ...knowledgeItems,
      {
        addedAt: Date.now(),
        id: crypto.randomUUID(),
        kind: "link",
        name,
        provider,
        url,
      },
    ]);
    setLinkOpen(false);
    toast.success("Link added to project knowledge.");
  };

  return (
    <div
      className={cn(
        `
          flex h-full min-h-0 w-full min-w-0 flex-col border-l border-border
          bg-muted/10
        `,
        className,
      )}
    >
      <div className="min-h-0 flex-1 flex flex-col gap-6 overflow-y-auto p-4">
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold">Instructions</h2>
            <span title="How the assistant should behave for this project">
              <Info aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          </div>
          <textarea
            className={`
              min-h-[140px] w-full resize-y rounded-lg border border-input
              bg-background px-3 py-2 text-sm
              placeholder:text-muted-foreground
              focus-visible:border-ring focus-visible:ring-[3px]
              focus-visible:ring-ring/50 focus-visible:outline-none
            `}
            onChange={(e) => onInstructionsChange(e.target.value)}
            placeholder="Tone, goals, and constraints for chats in this project."
            value={project.instructions}
          />
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-1.5">
            <h2 className="text-sm font-semibold">Project knowledge</h2>
            <span title="Documents and links the model can use as context">
              <Info aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
            </span>
          </div>

          <p className="text-xs leading-relaxed text-muted-foreground">
            Upload spreadsheets, docs, PDFs, or add a share link from Google
            Drive, Dropbox, OneDrive, Proton Drive, or similar. Executable and
            unsafe file types are not accepted. Links to localhost, private
            networks, and common internal or metadata hosts are blocked by site
            policy; the list is maintained and updated as needed.
          </p>

          <div className="flex flex-wrap gap-2">
            <input
              accept={ACCEPT_KNOWLEDGE}
              className="hidden"
              multiple
              onChange={(e) => {
                void addFiles(e.target.files);
                e.target.value = "";
              }}
              ref={fileRef}
              type="file"
            />
            <Button
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              {busy ? (
                <Loader2
                  aria-hidden
                  className="mr-1.5 h-3.5 w-3.5 animate-spin"
                />
              ) : (
                <Paperclip aria-hidden className="mr-1.5 h-3.5 w-3.5" />
              )}
              Upload from computer
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" type="button" variant="outline">
                  <Link2 aria-hidden className="mr-1.5 h-3.5 w-3.5" />
                  Add document link
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel
                  className={`text-xs font-normal text-muted-foreground`}
                >
                  Paste a share link to a file or folder
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openLinkDialog("google")}>
                  Google Drive
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openLinkDialog("dropbox")}>
                  Dropbox
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openLinkDialog("microsoft")}>
                  Microsoft OneDrive
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openLinkDialog("proton")}>
                  Proton Drive
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openLinkDialog("other")}>
                  Other (URL)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {knowledgeItems.length === 0 ? (
            <div
              className={`
                rounded-xl border border-dashed border-border/80 bg-muted/20
                px-4 py-8 text-center
              `}
            >
              <FileText
                aria-hidden
                className="mx-auto mb-2 h-8 w-8 text-muted-foreground/70"
              />
              <p className="text-sm font-medium">Nothing here yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Add files or links so the assistant can use this project&apos;s
                context.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {knowledgeItems.map((it) => (
                <li
                  className={`
                    flex items-start gap-2 rounded-lg border border-border
                    bg-background px-3 py-2 text-sm
                  `}
                  key={it.id}
                >
                  <FileText
                    aria-hidden
                    className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{it.name}</p>
                    {it.kind === "link" ? (
                      <p className="truncate text-xs text-muted-foreground">
                        {it.url}
                      </p>
                    ) : it.needsExtraction ? (
                      <p
                        className={`
                          text-xs text-amber-700
                          dark:text-amber-400
                        `}
                      >
                        Reference file — add a link or paste text in
                        instructions for full content.
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Embedded text ({it.textContent?.length ?? 0} chars)
                      </p>
                    )}
                  </div>
                  <Button
                    aria-label={`Remove ${it.name}`}
                    className="shrink-0"
                    onClick={() => removeItem(it.id)}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog onOpenChange={setLinkOpen} open={linkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add document link</DialogTitle>
            <DialogDescription>
              Paste a public or shared link. The assistant uses the URL as
              context; ensure the link is accessible to you.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="know-url">URL</Label>
              <input
                className={`
                  flex h-9 w-full rounded-md border border-input bg-background
                  px-3 py-1 text-sm
                  focus-visible:border-ring focus-visible:ring-[3px]
                  focus-visible:ring-ring/50 focus-visible:outline-none
                `}
                id="know-url"
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://…"
                value={linkUrl}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="know-name">Label (optional)</Label>
              <input
                className={`
                  flex h-9 w-full rounded-md border border-input bg-background
                  px-3 py-1 text-sm
                  focus-visible:border-ring focus-visible:ring-[3px]
                  focus-visible:ring-ring/50 focus-visible:outline-none
                `}
                id="know-name"
                onChange={(e) => setLinkName(e.target.value)}
                placeholder="e.g. Q1 budget sheet"
                value={linkName}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setLinkOpen(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button onClick={submitLink} type="button">
              Add link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
