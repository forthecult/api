"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { getMainAppUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import { SizeChartDataEditor, type SizeChartData } from "~/ui/size-chart-editor";

const API_BASE = getMainAppUrl();
const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

export default function AdminSizeChartsCreatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<"printful" | "printify" | "manual">("manual");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dataImperial, setDataImperial] = useState<SizeChartData | null>(null);
  const [dataMetric, setDataMetric] = useState<SizeChartData | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!brand.trim() || !model.trim() || !displayName.trim()) {
        setError("Brand, model and display name are required.");
        return;
      }
      setSaving(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/admin/size-charts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            provider,
            brand: brand.trim(),
            model: model.trim(),
            displayName: displayName.trim(),
            dataImperial: dataImperial ?? undefined,
            dataMetric: dataMetric ?? undefined,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Failed to create size chart");
        }
        router.push("/products/size-charts");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create");
      } finally {
        setSaving(false);
      }
    },
    [provider, brand, model, displayName, dataImperial, dataMetric, router],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/products/size-charts">
          <Button type="button" variant="ghost" size="sm">
            ← Size Charts
          </Button>
        </Link>
        <h2 className="text-2xl font-semibold tracking-tight">Add Size Chart</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <p className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Identity + Display Name */}
        <Card>
          <CardHeader>
            <CardTitle>New size chart (Brand + Model)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Use the same provider, brand and model as your products (e.g. Printful, Bella + Canvas, 3001).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="provider" className={labelClass}>
                  Provider
                </label>
                <select
                  id="provider"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as "printful" | "printify" | "manual")}
                  className={inputClass}
                >
                  <option value="printful">Printful</option>
                  <option value="printify">Printify</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div>
                <label htmlFor="brand" className={labelClass}>
                  Brand <span className="text-destructive">*</span>
                </label>
                <input
                  id="brand"
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Bella + Canvas"
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label htmlFor="model" className={labelClass}>
                  Model <span className="text-destructive">*</span>
                </label>
                <input
                  id="model"
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. 3001"
                  className={inputClass}
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="displayName" className={labelClass}>
                Display name (shown in accordion) <span className="text-destructive">*</span>
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Hoodies"
                className={inputClass}
                required
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
            {saving ? "Creating…" : "Create size chart"}
          </Button>
          <Link href="/products/size-charts">
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
