"use client";

import { Info, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { applyAiFullImport, buildAiFullExport } from "~/lib/ai-full-export";
import {
  buildAiExportPayload,
  clearAiLocalStorageOnly,
  downloadJson,
  estimateAiLocalBytes,
} from "~/lib/ai-local-bundle";
import {
  decryptBackupPlaintext,
  encryptBackupPlaintext,
  type EncryptedBackupWire,
} from "~/lib/ai-passphrase-backup";
import { useSession } from "~/lib/auth-client";
import { cn } from "~/lib/cn";
import { Button } from "~/ui/primitives/button";
import { Input } from "~/ui/primitives/input";
import { Label } from "~/ui/primitives/label";

const QUOTA_BYTES = 2 * 1024 * 1024 * 1024;

export function DashboardAiStorageClient() {
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user?.id);

  const [bytes, setBytes] = useState(0);
  const [_refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [cloudBackupAt, setCloudBackupAt] = useState<null | string>(null);

  const cloudBackupLabel = useMemo(() => {
    if (!cloudBackupAt) return null;
    return new Date(cloudBackupAt).toLocaleString();
  }, [cloudBackupAt]);

  const refreshStats = useCallback(() => {
    setBytes(estimateAiLocalBytes());
  }, []);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  useEffect(() => {
    if (!signedIn) {
      setCloudBackupAt(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/ai/backup", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          backup?: null | { updatedAt?: string };
        };
        if (cancelled) return;
        setCloudBackupAt(data.backup?.updatedAt ?? null);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const pctOfQuota = Math.min(1, bytes / QUOTA_BYTES);

  const onDownload = async () => {
    setBusy(true);
    try {
      const full = await buildAiFullExport();
      downloadJson(
        `ftc-ai-export-${new Date().toISOString().slice(0, 10)}.json`,
        full,
      );
      toast.success("Download started.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  };

  const onPickImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const json = JSON.parse(text) as unknown;
      await applyAiFullImport(json);
      toast.success("Import applied. Reload chat if it is open.");
      refreshStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const onDeleteLocal = () => {
    if (
      !confirm(
        "Delete all chats, projects, and local AI data in this browser? This cannot be undone.",
      )
    )
      return;
    clearAiLocalStorageOnly();
    toast.success("Local AI data cleared.");
    refreshStats();
  };

  const onCloudBackup = async () => {
    if (!signedIn) {
      toast.error("Sign in to use cloud backup.");
      return;
    }
    if (!passphrase.trim()) {
      toast.error("Enter a passphrase to encrypt your backup.");
      return;
    }
    setBusy(true);
    try {
      const full = await buildAiFullExport();
      const plain = JSON.stringify(full);
      if (plain.length > 2 * 1024 * 1024) {
        toast.error("Backup is too large for cloud storage (max 2 MB).");
        return;
      }
      const enc = await encryptBackupPlaintext(plain, passphrase);
      const res = await fetch("/api/ai/backup", {
        body: JSON.stringify({
          algorithm: enc.algorithm,
          ciphertext: enc.ciphertext,
          keyDerivation: enc.keyDerivation,
          nonce: enc.nonce,
        }),
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Encrypted backup saved to your account.");
      setRefresh((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Backup failed");
    } finally {
      setBusy(false);
    }
  };

  const onCloudRestore = async () => {
    if (!signedIn) {
      toast.error("Sign in to restore.");
      return;
    }
    if (!passphrase.trim()) {
      toast.error("Enter the passphrase you used for this backup.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/ai/backup", { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as {
        backup?: null | {
          ciphertext: string;
          keyDerivation: Record<string, unknown>;
          nonce: string;
        };
      };
      if (!data.backup) {
        toast.error("No cloud backup found.");
        return;
      }
      const wire: EncryptedBackupWire = {
        algorithm: "aes-256-gcm-pbkdf2-sha256",
        ciphertext: data.backup.ciphertext,
        keyDerivation: {
          iterations: Number(
            (data.backup.keyDerivation as { iterations?: number }).iterations ??
            250_000,
          ),
          saltB64: String(
            (data.backup.keyDerivation as { saltB64?: string }).saltB64 ?? "",
          ),
        },
        nonce: data.backup.nonce,
      };
      const plain = await decryptBackupPlaintext(wire, passphrase);
      const json = JSON.parse(plain) as unknown;
      await applyAiFullImport(json);
      toast.success("Restored from cloud backup.");
      refreshStats();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(false);
    }
  };

  const onCloudDelete = async () => {
    if (!signedIn) return;
    if (!confirm("Remove the encrypted backup from your account?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/ai/backup", {
        credentials: "include",
        method: "DELETE",
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("Cloud backup removed.");
      setRefresh((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const projectsCount = (() => {
    try {
      const p = buildAiExportPayload();
      const raw = p.localStorage["ftc-ai-projects"];
      if (!raw) return 0;
      const list = JSON.parse(raw) as unknown;
      return Array.isArray(list) ? list.length : 0;
    } catch {
      return 0;
    }
  })();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Storage &amp; data
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Chats and projects live in your browser unless you export them locally or save
          an encrypted, password protected, backup to your FTC account. Your passphrase is never sent to
          the server, so we will never be able to access your data.
        </p>
      </div>

      <section className="flex flex-col gap-2">
        <h2
          className={`
            text-xs font-semibold tracking-wide text-muted-foreground uppercase
          `}
        >
          Limits
        </h2>
        <div className="rounded-xl border border-border bg-card p-4">
          <div
            className={`
              flex flex-wrap items-center justify-between gap-2 border-b
              border-border/80 py-2
              first:pt-0
              last:border-b-0 last:pb-0
            `}
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Chat</span>
              <span
                aria-label="Info"
                className="inline-flex text-muted-foreground"
                title="Signed-in members use the model under your plan; guests may use free messages per character."
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </div>
            <span className="text-sm text-muted-foreground">
              {signedIn ? "Account chat" : "Guest limits apply on /chat"}
            </span>
          </div>
          <div
            className={`flex flex-wrap items-center justify-between gap-2 py-2`}
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Image</span>
              <span
                className="inline-flex text-muted-foreground"
                title="Vision uploads"
              >
                <Info className="h-3.5 w-3.5" />
              </span>
            </div>
            <span className="text-sm text-muted-foreground">—</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2
          className={`
            text-xs font-semibold tracking-wide text-muted-foreground uppercase
          `}
        >
          Local data
        </h2>
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <div>
            <div
              className={`
                flex flex-wrap items-center justify-between gap-2 text-sm
              `}
            >
              <span className="font-medium">Browser storage</span>
              <span
                className={`
                  inline-flex items-center gap-1 text-muted-foreground
                `}
              >
                <span title="Estimate of local chat data">
                  <Info aria-hidden className={`h-3.5 w-3.5`} />
                </span>
                {formatPct(pctOfQuota)}% of ~2 GB
              </span>
            </div>
            <div
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(pctOfQuota * 100)}
              className={cn(
                "mt-2 h-2 w-full overflow-hidden rounded-full bg-muted",
              )}
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${Math.min(100, pctOfQuota * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {projectsCount} project(s) in this browser ·{" "}
              {Math.round(bytes / 1024)} KB estimated
            </p>
          </div>

          <div
            className={`
              flex flex-col gap-3 border-t border-border pt-4
              sm:flex-row sm:items-start sm:justify-between
            `}
          >
            <div>
              <p className="font-medium">Delete all local chats</p>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                Removes chat sessions, messages, and projects from this browser.
                Account memories and custom prompts are not deleted—use the
                sections below or the cloud backup tools.
              </p>
            </div>
            <Button
              className="shrink-0"
              disabled={busy}
              onClick={onDeleteLocal}
              type="button"
              variant="destructive"
            >
              <Trash2 aria-hidden className="mr-1 h-4 w-4" />
              Delete
            </Button>
          </div>

          <div
            className={`
              flex flex-col gap-3 border-t border-border pt-4
              sm:flex-row sm:items-center sm:justify-between
            `}
          >
            <div>
              <p className="font-medium">Download</p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                JSON file including local chats, projects, and (when signed in)
                your account prompt settings and memories.
              </p>
            </div>
            <Button
              disabled={busy}
              onClick={() => void onDownload()}
              type="button"
              variant="outline"
            >
              Download chats
            </Button>
          </div>

          <div
            className={`
              flex flex-col gap-3 border-t border-border pt-4
              sm:flex-row sm:items-center sm:justify-between
            `}
          >
            <div>
              <p className="font-medium">Upload / restore</p>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Import a previously exported JSON file. Replaces local browser
                data and, when the file includes server data, updates your
                account.
              </p>
            </div>
            <div>
              <input
                accept="application/json,.json"
                className="hidden"
                id="ai-import"
                onChange={onPickImport}
                type="file"
              />
              <Button asChild disabled={busy} type="button" variant="outline">
                <label className="cursor-pointer" htmlFor="ai-import">
                  Upload file
                </label>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2
          className={`
            text-xs font-semibold tracking-wide text-muted-foreground uppercase
          `}
        >
          Cloud backup (encrypted)
        </h2>
        <div className="space-y-4 rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">
            Stores your chat history, projects, and memories our database (cloud backup). You can replace it anytime. We cannot access or restore your data if you lose your passphrase.
          </p>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ai-bak-pass">Passphrase</Label>
            <Input
              autoComplete="new-password"
              id="ai-bak-pass"
              onChange={(e) => setPassphrase(e.target.value)}
              placeholder="Passphrase only you know"
              type="password"
              value={passphrase}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !signedIn}
              onClick={() => void onCloudBackup()}
              type="button"
            >
              Save backup to account
            </Button>
            <Button
              disabled={busy || !signedIn}
              onClick={() => void onCloudRestore()}
              type="button"
              variant="outline"
            >
              Restore from account
            </Button>
            <Button
              disabled={busy || !signedIn}
              onClick={() => void onCloudDelete()}
              type="button"
              variant="ghost"
            >
              Remove cloud backup
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {cloudBackupLabel
              ? `Last cloud backup: ${cloudBackupLabel}`
              : signedIn
                ? "No cloud backup saved yet."
                : "Sign in to use cloud backup."}
          </p>
        </div>
      </section>
    </div>
  );
}

function formatPct(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0";
  return (n * 100).toFixed(2);
}
