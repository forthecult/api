"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import {
  SizeChartDataEditor,
  type SizeChartData,
} from "~/ui/size-chart-editor";

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
  const [success, setSuccess] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [dataImperial, setDataImperial] = useState<SizeChartData | null>(null);
  const [dataMetric, setDataMetric] = useState<SizeChartData | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/admin/size-charts/${id}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load");
        const data = (await res.json()) as SizeChart;
        if (!cancelled) {
          setChart(data);
          setDisplayName(data.displayName ?? "");
          setDataImperial(
            data.dataImperial != null
              ? typeof data.dataImperial === "string"
                ? (JSON.parse(data.dataImperial) as SizeChartData)
                : (data.dataImperial as SizeChartData)
              : null,
          );
          setDataMetric(
            data.dataMetric != null
              ? typeof data.dataMetric === "string"
                ? (JSON.parse(data.dataMetric) as SizeChartData)
                : (data.dataMetric as SizeChartData)
              : null,
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
      setSuccess(false);
      try {
        const res = await fetch(`${API_BASE}/api/admin/size-charts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            displayName: displayName.trim(),
            dataImperial: dataImperial ?? null,
            dataMetric: dataMetric ?? null,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(body.error ?? "Failed to update");
        }
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update");
      } finally {
        setSaving(false);
      }
    },
    [id, chart, displayName, dataImperial, dataMetric],
  );

  if (loading || !chart) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        {loading ? "Loading…" : (error ?? "Size chart not found.")}
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-md border border-green-500/50 bg-green-500/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">
            Size chart saved successfully.
          </p>
        )}

        {/* Identity (read-only) + Display Name */}
        <Card>
          <CardHeader>
            <CardTitle>
              {chart.provider} · {chart.brand} · {chart.model}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Provider, brand, and model cannot be changed. Edit display name
              and size data below.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className={labelClass}>Provider</label>
                <input
                  type="text"
                  value={chart.provider}
                  disabled
                  className={inputClass + " opacity-60"}
                />
              </div>
              <div>
                <label className={labelClass}>Brand</label>
                <input
                  type="text"
                  value={chart.brand}
                  disabled
                  className={inputClass + " opacity-60"}
                />
              </div>
              <div>
                <label className={labelClass}>Model</label>
                <input
                  type="text"
                  value={chart.model}
                  disabled
                  className={inputClass + " opacity-60"}
                />
              </div>
            </div>
            <div>
              <label htmlFor="displayName" className={labelClass}>
                Display name (shown in accordion){" "}
                <span className="text-destructive">*</span>
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputClass}
                required
                placeholder="e.g. Hoodies"
              />
            </div>
          </CardContent>
        </Card>

        {/* Imperial data */}
        <Card>
          <CardContent className="pt-6">
            <SizeChartDataEditor
              label="Imperial (inches)"
              data={dataImperial}
              onChange={setDataImperial}
            />
          </CardContent>
        </Card>

        {/* Metric data */}
        <Card>
          <CardContent className="pt-6">
            <SizeChartDataEditor
              label="Metric (cm)"
              data={dataMetric}
              onChange={setDataMetric}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
          <Link href="/products/size-charts">
            <Button type="button" variant="outline">
              Back to list
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
