"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

import { getAdminApiBaseUrl } from "~/lib/env";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";
import {
  type SizeChartData,
  SizeChartDataEditor,
} from "~/ui/size-chart-editor";

const API_BASE = getAdminApiBaseUrl();
const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const labelClass = "mb-1.5 block text-sm font-medium";

export default function AdminSizeChartsCreatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<null | string>(null);
  const [provider, setProvider] = useState<"manual" | "printful" | "printify">(
    "manual",
  );
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dataImperial, setDataImperial] = useState<null | SizeChartData>(null);
  const [dataMetric, setDataMetric] = useState<null | SizeChartData>(null);

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
          body: JSON.stringify({
            brand: brand.trim(),
            dataImperial: dataImperial ?? undefined,
            dataMetric: dataMetric ?? undefined,
            displayName: displayName.trim(),
            model: model.trim(),
            provider,
          }),
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
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
          <Button size="sm" type="button" variant="ghost">
            ← Size Charts
          </Button>
        </Link>
        <h2 className="text-2xl font-semibold tracking-tight">
          Add Size Chart
        </h2>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {error && (
          <p
            className={`
              rounded-md border border-destructive/50 bg-destructive/10 px-3
              py-2 text-sm text-destructive
            `}
          >
            {error}
          </p>
        )}

        {/* Identity + Display Name */}
        <Card>
          <CardHeader>
            <CardTitle>New size chart (Brand + Model)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Use the same provider, brand and model as your products (e.g.
              Printful, Bella + Canvas, 3001).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`
                grid gap-4
                sm:grid-cols-3
              `}
            >
              <div>
                <label className={labelClass} htmlFor="provider">
                  Provider
                </label>
                <select
                  className={inputClass}
                  id="provider"
                  onChange={(e) =>
                    setProvider(
                      e.target.value as "manual" | "printful" | "printify",
                    )
                  }
                  value={provider}
                >
                  <option value="printful">Printful</option>
                  <option value="printify">Printify</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
              <div>
                <label className={labelClass} htmlFor="brand">
                  Brand <span className="text-destructive">*</span>
                </label>
                <input
                  className={inputClass}
                  id="brand"
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. Bella + Canvas"
                  required
                  type="text"
                  value={brand}
                />
              </div>
              <div>
                <label className={labelClass} htmlFor="model">
                  Model <span className="text-destructive">*</span>
                </label>
                <input
                  className={inputClass}
                  id="model"
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. 3001"
                  required
                  type="text"
                  value={model}
                />
              </div>
            </div>
            <div>
              <label className={labelClass} htmlFor="displayName">
                Display name (shown in accordion){" "}
                <span className="text-destructive">*</span>
              </label>
              <input
                className={inputClass}
                id="displayName"
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Hoodies"
                required
                type="text"
                value={displayName}
              />
            </div>
          </CardContent>
        </Card>

        {/* Imperial data */}
        <Card>
          <CardContent className="pt-6">
            <SizeChartDataEditor
              data={dataImperial}
              label="Imperial (inches)"
              onChange={setDataImperial}
            />
          </CardContent>
        </Card>

        {/* Metric data */}
        <Card>
          <CardContent className="pt-6">
            <SizeChartDataEditor
              data={dataMetric}
              label="Metric (cm)"
              onChange={setDataMetric}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button disabled={saving} type="submit">
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
