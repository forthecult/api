"use client";

import { Pencil, Plus, RefreshCw, Ruler, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { cn } from "~/lib/cn";
import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();

type SizeChartRow = {
  id: string;
  provider: string;
  brand: string;
  model: string;
  displayName: string;
  dataImperial: unknown;
  dataMetric: unknown;
  updatedAt: string;
};

export default function AdminSizeChartsPage() {
  const [items, setItems] = useState<SizeChartRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [fixingNames, setFixingNames] = useState(false);
  const [fixResult, setFixResult] = useState<string | null>(null);

  const fetchCharts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/size-charts`, { credentials: "include" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SizeChartRow[];
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load size charts");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCharts();
  }, [fetchCharts]);

  const handleDelete = useCallback(
    async (id: string, label: string) => {
      if (!window.confirm(`Delete size chart "${label}"? This cannot be undone.`)) return;
      setDeletingId(id);
      try {
        const res = await fetch(`${API_BASE}/api/admin/size-charts/${id}`, {
          method: "DELETE",
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to delete");
        setItems((prev) => prev.filter((r) => r.id !== id));
      } catch {
        void fetchCharts();
      } finally {
        setDeletingId(null);
      }
    },
    [fetchCharts],
  );

  const handleFixNames = useCallback(async () => {
    setFixingNames(true);
    setFixResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/printful/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "fix_size_chart_names" }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as { fixed: number; total: number };
      setFixResult(`Fixed ${data.fixed} of ${data.total} display names.`);
      if (data.fixed > 0) void fetchCharts();
    } catch {
      setFixResult("Failed to fix display names.");
    } finally {
      setFixingNames(false);
    }
  }, [fetchCharts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold tracking-tight">Size Charts</h2>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={handleFixNames}
            disabled={fixingNames}
          >
            <RefreshCw className={cn("size-4", fixingNames && "animate-spin")} /> Fix Names
          </Button>
          <Link href="/products/size-charts/create">
            <Button type="button" className="gap-2">
              <Plus className="size-4" /> Add Size Chart
            </Button>
          </Link>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        Size charts are stored once per Brand + Model. Products with the same brand and model (e.g. Bella + Canvas 3001)
        share one chart. Charts are imported from Printful when you sync products; you can also add or edit them manually.
      </p>

      {fixResult && (
        <p className={cn(
          "rounded-md border px-3 py-2 text-sm",
          fixResult.startsWith("Failed")
            ? "border-destructive/50 bg-destructive/10 text-destructive"
            : "border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-400",
        )}>
          {fixResult}
        </p>
      )}

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Ruler className="size-5" /> All size charts
          </CardTitle>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Filter by provider, brand or model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(
                "w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm",
                "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
              aria-label="Filter size charts"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center text-muted-foreground">
              Loading…
            </div>
          ) : error ? (
            <div className="p-6 text-destructive">
              {error}
              <Button className="mt-2" variant="outline" onClick={() => void fetchCharts()} type="button">
                Retry
              </Button>
            </div>
          ) : (() => {
            const term = search.trim().toLowerCase();
            const filtered =
              term === ""
                ? items
                : items.filter(
                    (r) =>
                      r.provider.toLowerCase().includes(term) ||
                      r.brand.toLowerCase().includes(term) ||
                      r.model.toLowerCase().includes(term) ||
                      r.displayName.toLowerCase().includes(term),
                  );
            return filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {search.trim() ? "No size charts match your filter." : "No size charts yet. Sync Printful products or add one manually."}
              </div>
            ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <th className="p-4 font-medium" scope="col">Provider</th>
                    <th className="p-4 font-medium" scope="col">Brand</th>
                    <th className="p-4 font-medium" scope="col">Model</th>
                    <th className="p-4 font-medium" scope="col">Display name</th>
                    <th className="p-4 font-medium" scope="col">Imperial</th>
                    <th className="p-4 font-medium" scope="col">Metric</th>
                    <th className="p-4 font-medium" scope="col">Updated</th>
                    <th className="p-4 font-medium" scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="p-4 capitalize">{row.provider}</td>
                      <td className="p-4 font-medium">{row.brand}</td>
                      <td className="p-4 font-mono text-muted-foreground">{row.model}</td>
                      <td className="p-4">{row.displayName}</td>
                      <td className="p-4">{row.dataImperial != null ? "Yes" : "—"}</td>
                      <td className="p-4">{row.dataMetric != null ? "Yes" : "—"}</td>
                      <td className="p-4 text-muted-foreground">
                        {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/products/size-charts/${row.id}/edit`}>
                            <Button type="button" variant="ghost" size="sm" className="gap-1">
                              <Pencil className="size-3" /> Edit
                            </Button>
                          </Link>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-destructive hover:text-destructive"
                            disabled={deletingId === row.id}
                            onClick={() => handleDelete(row.id, `${row.brand} ${row.model}`)}
                          >
                            <Trash2 className="size-3" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
