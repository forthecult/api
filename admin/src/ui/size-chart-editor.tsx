"use client";

import { Minus, Plus, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { cn } from "~/lib/cn";
import { Button } from "~/ui/button";

/* ------------------------------------------------------------------ */
/*  Types matching the stored JSON schema                             */
/* ------------------------------------------------------------------ */

type MeasurementValue =
  | { size: string; value: string }
  | { size: string; min_value: string; max_value: string };

type Measurement = {
  type_label: string;
  values: MeasurementValue[];
};

type SizeTable = {
  type: string;
  unit: string;
  description?: string;
  image_url?: string;
  measurements?: Measurement[];
};

export type SizeChartData = {
  availableSizes?: string[];
  sizeTables?: SizeTable[];
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function isRange(v: MeasurementValue): v is { size: string; min_value: string; max_value: string } {
  return "min_value" in v;
}

/** Get the display value for a cell */
function cellDisplay(v: MeasurementValue | undefined): string {
  if (!v) return "";
  if (isRange(v)) return v.min_value && v.max_value ? `${v.min_value} - ${v.max_value}` : v.min_value || v.max_value || "";
  return v.value ?? "";
}

/** Extract all unique sizes across all measurements in a table, preserving order */
function extractSizes(table: SizeTable): string[] {
  const seen = new Set<string>();
  const sizes: string[] = [];
  for (const m of table.measurements ?? []) {
    for (const v of m.values) {
      if (!seen.has(v.size)) {
        seen.add(v.size);
        sizes.push(v.size);
      }
    }
  }
  return sizes;
}

/** Get value for a specific size from a measurement */
function getValueForSize(m: Measurement, size: string): MeasurementValue | undefined {
  return m.values.find((v) => v.size === size);
}

/* ------------------------------------------------------------------ */
/*  Cell Editor                                                       */
/* ------------------------------------------------------------------ */

const cellInputClass =
  "w-full min-w-[60px] rounded border border-input bg-background px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-ring";

function CellEditor({
  value,
  isRangeMode,
  onChange,
}: {
  value: MeasurementValue | undefined;
  isRangeMode: boolean;
  onChange: (v: MeasurementValue | null) => void;
}) {
  if (isRangeMode) {
    const min = value && isRange(value) ? value.min_value : "";
    const max = value && isRange(value) ? value.max_value : "";
    return (
      <div className="flex items-center gap-0.5">
        <input
          type="text"
          value={min}
          onChange={(e) =>
            onChange({
              size: value?.size ?? "",
              min_value: e.target.value,
              max_value: max,
            })
          }
          className={cn(cellInputClass, "min-w-[40px]")}
          placeholder="min"
        />
        <span className="text-[10px] text-muted-foreground">–</span>
        <input
          type="text"
          value={max}
          onChange={(e) =>
            onChange({
              size: value?.size ?? "",
              min_value: min,
              max_value: e.target.value,
            })
          }
          className={cn(cellInputClass, "min-w-[40px]")}
          placeholder="max"
        />
      </div>
    );
  }

  const single = value && !isRange(value) ? value.value : "";
  return (
    <input
      type="text"
      value={single}
      onChange={(e) => onChange({ size: value?.size ?? "", value: e.target.value })}
      className={cellInputClass}
      placeholder="—"
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Single Size Table Editor                                          */
/* ------------------------------------------------------------------ */

function SingleTableEditor({
  table,
  tableIndex,
  onUpdate,
  onRemove,
  canRemove,
}: {
  table: SizeTable;
  tableIndex: number;
  onUpdate: (t: SizeTable) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const sizes = useMemo(() => extractSizes(table), [table]);
  const measurements = table.measurements ?? [];

  /** Check if any measurement in this table uses range values */
  const hasRanges = useMemo(
    () => measurements.some((m) => m.values.some(isRange)),
    [measurements],
  );

  const [showRanges, setShowRanges] = useState(hasRanges);
  const [newSizeInput, setNewSizeInput] = useState("");
  const [newMeasurementInput, setNewMeasurementInput] = useState("");

  const updateMeasurementValue = useCallback(
    (mIdx: number, size: string, newVal: MeasurementValue | null) => {
      const updated = { ...table, measurements: [...measurements] };
      const m = { ...measurements[mIdx]!, values: [...measurements[mIdx]!.values] };
      const vIdx = m.values.findIndex((v) => v.size === size);
      if (newVal === null) {
        if (vIdx >= 0) m.values.splice(vIdx, 1);
      } else {
        const withSize = { ...newVal, size };
        if (vIdx >= 0) m.values[vIdx] = withSize;
        else m.values.push(withSize);
      }
      updated.measurements![mIdx] = m;
      onUpdate(updated);
    },
    [table, measurements, onUpdate],
  );

  const updateMeasurementLabel = useCallback(
    (mIdx: number, label: string) => {
      const updated = { ...table, measurements: [...measurements] };
      updated.measurements![mIdx] = { ...measurements[mIdx]!, type_label: label };
      onUpdate(updated);
    },
    [table, measurements, onUpdate],
  );

  const removeMeasurement = useCallback(
    (mIdx: number) => {
      const updated = { ...table, measurements: measurements.filter((_, i) => i !== mIdx) };
      onUpdate(updated);
    },
    [table, measurements, onUpdate],
  );

  const addMeasurement = useCallback(() => {
    const label = newMeasurementInput.trim();
    if (!label) return;
    const newM: Measurement = {
      type_label: label,
      values: sizes.map((s) =>
        showRanges ? { size: s, min_value: "", max_value: "" } : { size: s, value: "" },
      ),
    };
    const updated = { ...table, measurements: [...measurements, newM] };
    onUpdate(updated);
    setNewMeasurementInput("");
  }, [table, measurements, sizes, newMeasurementInput, showRanges, onUpdate]);

  const addSize = useCallback(() => {
    const size = newSizeInput.trim();
    if (!size || sizes.includes(size)) return;
    // Add this size to every measurement with an empty value
    const updated = {
      ...table,
      measurements: measurements.map((m) => ({
        ...m,
        values: [
          ...m.values,
          showRanges
            ? { size, min_value: "", max_value: "" }
            : { size, value: "" },
        ],
      })),
    };
    onUpdate(updated);
    setNewSizeInput("");
  }, [table, measurements, sizes, newSizeInput, showRanges, onUpdate]);

  const removeSize = useCallback(
    (size: string) => {
      const updated = {
        ...table,
        measurements: measurements.map((m) => ({
          ...m,
          values: m.values.filter((v) => v.size !== size),
        })),
      };
      onUpdate(updated);
    },
    [table, measurements, onUpdate],
  );

  const toggleRangeMode = useCallback(() => {
    const next = !showRanges;
    setShowRanges(next);
    // Convert all values when toggling
    const updated = {
      ...table,
      measurements: measurements.map((m) => ({
        ...m,
        values: m.values.map((v) => {
          if (next) {
            // single → range
            const val = !isRange(v) ? v.value : "";
            return { size: v.size, min_value: val, max_value: val };
          }
          // range → single (use min or combined)
          const display = isRange(v) ? (v.min_value || v.max_value || "") : v.value;
          return { size: v.size, value: display ?? "" };
        }),
      })),
    };
    onUpdate(updated);
  }, [showRanges, table, measurements, onUpdate]);

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      {/* Table header info */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">Type</label>
            <input
              type="text"
              value={table.type}
              onChange={(e) => onUpdate({ ...table, type: e.target.value })}
              className="rounded border border-input bg-background px-2 py-1 text-xs"
              placeholder="e.g. measure_yourself"
            />
            <label className="ml-2 text-xs font-medium text-muted-foreground">Unit</label>
            <input
              type="text"
              value={table.unit}
              onChange={(e) => onUpdate({ ...table, unit: e.target.value })}
              className="w-20 rounded border border-input bg-background px-2 py-1 text-xs"
              placeholder="inches"
            />
          </div>
          {table.description && (
            <p className="text-xs text-muted-foreground line-clamp-1">{table.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleRangeMode}
            className="text-xs"
          >
            {showRanges ? "Single values" : "Min–Max ranges"}
          </Button>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onRemove}
              className="text-destructive hover:text-destructive"
            >
              <X className="size-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Measurement grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="px-2 py-1.5 text-left font-medium text-muted-foreground min-w-[140px]">
                Measurement
              </th>
              {sizes.map((size) => (
                <th key={size} className="px-1 py-1.5 text-center font-medium">
                  <div className="flex items-center justify-center gap-1">
                    <span>{size}</span>
                    <button
                      type="button"
                      onClick={() => removeSize(size)}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                      title={`Remove size ${size}`}
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                </th>
              ))}
              <th className="px-1 py-1.5 text-center">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={newSizeInput}
                    onChange={(e) => setNewSizeInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addSize(); } }}
                    className="w-16 rounded border border-dashed border-input bg-background px-1.5 py-0.5 text-xs text-center"
                    placeholder="+ size"
                  />
                  <button
                    type="button"
                    onClick={addSize}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                    title="Add size"
                  >
                    <Plus className="size-3" />
                  </button>
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {measurements.map((m, mIdx) => (
              <tr key={mIdx} className="border-b last:border-0">
                <td className="px-2 py-1">
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={m.type_label}
                      onChange={(e) => updateMeasurementLabel(mIdx, e.target.value)}
                      className="flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs font-medium hover:border-input focus:border-input focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => removeMeasurement(mIdx)}
                      className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                      title="Remove measurement"
                    >
                      <Minus className="size-3" />
                    </button>
                  </div>
                </td>
                {sizes.map((size) => (
                  <td key={size} className="px-1 py-1">
                    <CellEditor
                      value={getValueForSize(m, size)}
                      isRangeMode={showRanges}
                      onChange={(v) => updateMeasurementValue(mIdx, size, v)}
                    />
                  </td>
                ))}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add measurement row */}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="text"
          value={newMeasurementInput}
          onChange={(e) => setNewMeasurementInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMeasurement(); } }}
          className="max-w-[200px] rounded border border-dashed border-input bg-background px-2 py-1 text-xs"
          placeholder="e.g. Chest Width"
        />
        <Button type="button" variant="outline" size="sm" onClick={addMeasurement} className="gap-1 text-xs">
          <Plus className="size-3" /> Add measurement
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main SizeChartDataEditor                                          */
/* ------------------------------------------------------------------ */

export function SizeChartDataEditor({
  label,
  data,
  onChange,
}: {
  label: string;
  data: SizeChartData | null;
  onChange: (d: SizeChartData | null) => void;
}) {
  const [mode, setMode] = useState<"visual" | "json">("visual");
  const [jsonRaw, setJsonRaw] = useState(() =>
    data != null ? JSON.stringify(data, null, 2) : "",
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const tables = data?.sizeTables ?? [];

  const updateTable = useCallback(
    (idx: number, t: SizeTable) => {
      const next = [...tables];
      next[idx] = t;
      const updated: SizeChartData = {
        ...data,
        sizeTables: next,
        availableSizes: deriveAvailableSizes(next),
      };
      onChange(updated);
      setJsonRaw(JSON.stringify(updated, null, 2));
    },
    [data, tables, onChange],
  );

  const removeTable = useCallback(
    (idx: number) => {
      const next = tables.filter((_, i) => i !== idx);
      const updated: SizeChartData = {
        ...data,
        sizeTables: next,
        availableSizes: deriveAvailableSizes(next),
      };
      onChange(next.length > 0 ? updated : null);
      setJsonRaw(next.length > 0 ? JSON.stringify(updated, null, 2) : "");
    },
    [data, tables, onChange],
  );

  const addTable = useCallback(() => {
    const newTable: SizeTable = {
      type: "measure_yourself",
      unit: label.toLowerCase().includes("metric") ? "cm" : "inches",
      measurements: [],
    };
    const next = [...tables, newTable];
    const updated: SizeChartData = {
      ...data,
      sizeTables: next,
      availableSizes: data?.availableSizes ?? [],
    };
    onChange(updated);
    setJsonRaw(JSON.stringify(updated, null, 2));
  }, [data, tables, label, onChange]);

  const applyJson = useCallback(() => {
    const trimmed = jsonRaw.trim();
    if (!trimmed) {
      onChange(null);
      setJsonError(null);
      return;
    }
    try {
      const parsed = JSON.parse(trimmed) as SizeChartData;
      onChange(parsed);
      setJsonError(null);
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "Invalid JSON");
    }
  }, [jsonRaw, onChange]);

  const switchToJson = useCallback(() => {
    setJsonRaw(data != null ? JSON.stringify(data, null, 2) : "");
    setJsonError(null);
    setMode("json");
  }, [data]);

  const switchToVisual = useCallback(() => {
    // Try to apply any pending JSON changes first
    if (jsonRaw.trim()) {
      try {
        const parsed = JSON.parse(jsonRaw) as SizeChartData;
        onChange(parsed);
      } catch {
        // keep current data
      }
    }
    setMode("visual");
  }, [jsonRaw, onChange]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{label}</h3>
        <div className="flex rounded-md border border-input text-xs">
          <button
            type="button"
            onClick={switchToVisual}
            className={cn(
              "px-3 py-1 rounded-l-md transition-colors",
              mode === "visual"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted",
            )}
          >
            Visual
          </button>
          <button
            type="button"
            onClick={switchToJson}
            className={cn(
              "px-3 py-1 rounded-r-md transition-colors",
              mode === "json"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-muted",
            )}
          >
            JSON
          </button>
        </div>
      </div>

      {mode === "visual" ? (
        <div className="space-y-4">
          {tables.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No size data yet.
            </div>
          ) : (
            tables.map((t, idx) => (
              <SingleTableEditor
                key={idx}
                table={t}
                tableIndex={idx}
                onUpdate={(updated) => updateTable(idx, updated)}
                onRemove={() => removeTable(idx)}
                canRemove={tables.length > 1}
              />
            ))
          )}
          <Button type="button" variant="outline" size="sm" onClick={addTable} className="gap-1">
            <Plus className="size-3" /> Add size table
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea
            rows={12}
            value={jsonRaw}
            onChange={(e) => { setJsonRaw(e.target.value); setJsonError(null); }}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            placeholder='{ "availableSizes": ["S","M","L"], "sizeTables": [...] }'
          />
          {jsonError && (
            <p className="text-xs text-destructive">{jsonError}</p>
          )}
          <Button type="button" variant="outline" size="sm" onClick={applyJson}>
            Apply JSON
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Utility                                                           */
/* ------------------------------------------------------------------ */

function deriveAvailableSizes(tables: SizeTable[]): string[] {
  const seen = new Set<string>();
  const sizes: string[] = [];
  for (const t of tables) {
    for (const s of extractSizes(t)) {
      if (!seen.has(s)) {
        seen.add(s);
        sizes.push(s);
      }
    }
  }
  return sizes;
}
