"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import type { TokenGateRow } from "~/ui/token-gates-list";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import { TokenGatesList } from "~/ui/token-gates-list";

const API_BASE = getMainAppUrl();

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

export default function AdminPageTokenGatesPage() {
  const [slug, setSlug] = useState("");
  const [existingSlugs, setExistingSlugs] = useState<string[]>([]);
  const [gates, setGates] = useState<TokenGateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [loadedSlug, setLoadedSlug] = useState<null | string>(null);

  const fetchExistingSlugs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/token-gate/pages`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { slugs?: string[] };
      setExistingSlugs(data.slugs ?? []);
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    void fetchExistingSlugs();
  }, [fetchExistingSlugs]);

  const loadGates = useCallback(
    async (slugOverride?: string) => {
      const raw = String(slugOverride ?? slug ?? "")
        .trim()
        .toLowerCase()
        .replace(/^\//, "")
        .replace(/\//g, "-");
      if (!raw) {
        setError("Enter a page slug (e.g. about, token).");
        return;
      }
      if (typeof slugOverride === "string") setSlug(raw);
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `${API_BASE}/api/admin/token-gate/pages/${encodeURIComponent(raw)}`,
          { credentials: "include" },
        );
        if (!res.ok) {
          if (res.status === 404) {
            setGates([]);
            setLoadedSlug(raw);
            return;
          }
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          gates: TokenGateRow[];
          pageSlug: string;
        };
        setGates(data.gates ?? []);
        setLoadedSlug(data.pageSlug);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
        setLoadedSlug(null);
      } finally {
        setLoading(false);
      }
    },
    [slug],
  );

  const saveGates = useCallback(async () => {
    const s =
      loadedSlug ??
      String(slug ?? "")
        .trim()
        .toLowerCase()
        .replace(/^\//, "")
        .replace(/\//g, "-");
    if (!s) {
      setError("Enter a page slug first.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/token-gate/pages/${encodeURIComponent(s)}`,
        {
          body: JSON.stringify({ gates }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "PATCH",
        },
      );
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Failed to save");
      }
      const data = (await res.json()) as {
        gates: TokenGateRow[];
        pageSlug: string;
      };
      setGates(data.gates ?? []);
      setLoadedSlug(data.pageSlug);
      void fetchExistingSlugs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [loadedSlug, slug, gates, fetchExistingSlugs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Page token gates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Require users to hold tokens to view a page by slug (e.g. /about,
          /token). Add gates for a slug; visitors must satisfy at least one
          (OR).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select or enter page slug</CardTitle>
          <p className="text-sm text-muted-foreground">
            Use the URL path without leading slash (e.g. about, token, faq).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              className={cn(inputClass, "max-w-xs")}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="e.g. about, token"
              type="text"
              value={slug}
            />
            <Button
              disabled={loading}
              onClick={() => void loadGates()}
              type="button"
            >
              {loading ? "Loading…" : "Load / Create"}
            </Button>
          </div>
          {existingSlugs.length > 0 && (
            <div className="space-y-2">
              <span className={labelClass}>Existing gated pages:</span>
              <div className="flex flex-wrap gap-2">
                {existingSlugs.map((s) => (
                  <Button
                    key={s}
                    onClick={() => loadGates(s)}
                    size="sm"
                    type="button"
                    variant={loadedSlug === s ? "default" : "outline"}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div
          className={`
            rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2
            text-sm text-destructive
          `}
        >
          {error}
        </div>
      )}

      {(loadedSlug !== null || gates.length > 0) && (
        <>
          <TokenGatesList
            description="User must hold ≥ quantity of ANY token to view this page."
            gates={gates}
            inputClass={inputClass}
            labelClass={labelClass}
            onChange={setGates}
            title={
              loadedSlug ? `Token gates for /${loadedSlug}` : "Token gates"
            }
          />
          <div className="flex gap-2">
            <Button disabled={saving} onClick={saveGates}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Link
              className={cn(
                `
                  inline-flex items-center justify-center rounded-md border
                  border-input bg-background px-4 py-2 text-sm font-medium
                  transition-colors
                  hover:bg-muted
                `,
              )}
              href="/token-gates/pages"
            >
              Cancel
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
