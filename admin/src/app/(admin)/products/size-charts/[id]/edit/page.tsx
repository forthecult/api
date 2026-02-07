"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const API_BASE = getMainAppUrl();
const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

type SizeChart = {
  id: string;
  provider: string;
  brand: string;
  model: string;
  displayName: string;
  dataImperial: unknown;
  dataMetric: unknown;
};

export default function AdminSizeChartsEditPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const [chart, setChart] = useState<SizeChart | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [dataImperialRaw, setDataImperialRaw] = useState("");
  const [dataMetricRaw, setDataMetricRaw] = useState("");

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/size-charts/${id}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as SizeChart;
        if (!cancelled) {
          setChart(data);
          setDisplayName(data.displayName ?? "");
          setDataImperialRaw(
            data.dataImperial != null ? JSON.stringify(data.dataImperial, null, 2) : "",
          );
          setDataMetricRaw(
            data.dataMetric != null ? JSON.stringify(data.dataMetric, null, 2) : "",
          );
        }
      } catch {
        if (!cancelled) setError("Failed to load size chart");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!id || !chart) return;
      setSaving(true);
      setError(null);
      try {
        let dataImperial: unknown = undefined;
        let dataMetric: unknown = undefined;
        if (dataImperialRaw.trim()) {
          try {
            dataImperial = JSON.parse(dataImperialRaw) as unknown;
          } catch {
            setError("Imperial data must be valid JSON.");
            setSaving(false);
            return;
          }
        }
        if (dataMetricRaw.trim()) {
          try {
            dataMetric = JSON.parse(dataMetricRaw) as unknown;
          } catch {
            setError("Metric data must be valid JSON.");
            setSaving(false);
            return;
          }
        }
        const res = await fetch(`${API_BASE}/api/admin/size-charts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            displayName: displayName.trim(),
            dataImperial,
            dataMetric,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Failed to update");
        }
        router.push("/products/size-charts");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update");
      } finally {
        setSaving(false);
      }
    },
    [id, chart, displayName, dataImperialRaw, dataMetricRaw, router],
  );

  if (loading || !chart) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        {loading ? "Loading…" : error ?? "Size chart not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/products/size-charts">
          <Button type="button" variant="ghost" size="sm">
            ← Size Charts
          </Button>
        </Link>
        <h2 className="text-2xl font-semibold tracking-tight">
          Edit: {chart.brand} {chart.model}
        </h2>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>
            {chart.provider} · {chart.brand} · {chart.model}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Provider, brand and model cannot be changed. Edit display name and size data below.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            <div>
              <label htmlFor="displayName" className={labelClass}>
                Display name (accordion title) <span className="text-destructive">*</span>
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label htmlFor="dataImperial" className={labelClass}>
                Data (Imperial / inches) – JSON
              </label>
              <textarea
                id="dataImperial"
                rows={8}
                value={dataImperialRaw}
                onChange={(e) => setDataImperialRaw(e.target.value)}
                className={inputClass + " font-mono text-xs"}
              />
            </div>
            <div>
              <label htmlFor="dataMetric" className={labelClass}>
                Data (Metric / cm) – JSON
              </label>
              <textarea
                id="dataMetric"
                rows={8}
                value={dataMetricRaw}
                onChange={(e) => setDataMetricRaw(e.target.value)}
                className={inputClass + " font-mono text-xs"}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Link href="/products/size-charts">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
