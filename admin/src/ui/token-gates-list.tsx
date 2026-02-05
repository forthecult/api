"use client";

import { Plus, Trash2 } from "lucide-react";

import { cn } from "~/lib/cn";
import { TOKEN_GATE_NETWORKS } from "~/lib/token-gating";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

export type TokenGateRow = {
  id?: string;
  tokenSymbol: string;
  quantity: number;
  network: string | null;
  contractAddress: string | null;
};

const defaultInputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const defaultLabelClass = "mb-1.5 block text-sm font-medium";

type Props = {
  gates: TokenGateRow[];
  onChange: (gates: TokenGateRow[]) => void;
  title?: string;
  description?: string;
  inputClass?: string;
  labelClass?: string;
  /** When set, show a "Token gated" checkbox at the top; list and Add button only when checked */
  tokenGated?: boolean;
  onTokenGatedChange?: (v: boolean) => void;
};

function nextId(): string {
  return `tg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function TokenGatesList({
  gates,
  onChange,
  title = "Multiple token gates",
  description = "Access if user holds ≥ quantity of ANY token (OR). Add rows for multiple options.",
  inputClass = defaultInputClass,
  labelClass = defaultLabelClass,
  tokenGated,
  onTokenGatedChange,
}: Props) {
  const addGate = () => {
    onChange([
      ...gates,
      {
        id: nextId(),
        tokenSymbol: "CULT",
        quantity: 1000,
        network: "solana",
        contractAddress: null,
      },
    ]);
  };

  const updateGate = (index: number, updates: Partial<TokenGateRow>) => {
    const next = [...gates];
    next[index] = { ...next[index], ...updates };
    onChange(next);
  };

  const removeGate = (index: number) => {
    onChange(gates.filter((_, i) => i !== index));
  };

  const showGatesList = tokenGated === undefined || tokenGated;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
        {onTokenGatedChange !== undefined && (
          <label className="mt-2 flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={tokenGated ?? false}
              onChange={(e) => onTokenGatedChange(e.target.checked)}
              className={cn(
                "size-4 rounded border-input text-primary focus:ring-ring",
              )}
            />
            <span className="text-sm font-medium">Token gated</span>
          </label>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showGatesList ? (
          <>
        {gates.map((gate, index) => (
          <div
            key={gate.id ?? index}
            className={cn(
              "rounded-lg border border-border bg-muted/30 p-4 space-y-3",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Gate {index + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeGate(index)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className={labelClass}>Token symbol</label>
                <input
                  type="text"
                  value={gate.tokenSymbol}
                  onChange={(e) =>
                    updateGate(index, {
                      tokenSymbol: e.target.value.trim().toUpperCase() || "",
                    })
                  }
                  className={inputClass}
                  placeholder="e.g. CULT, WHALE"
                />
              </div>
              <div className="space-y-1">
                <label className={labelClass}>Min quantity</label>
                <input
                  type="number"
                  min={1}
                  value={gate.quantity}
                  onChange={(e) => {
                    const v = Number.parseInt(e.target.value, 10);
                    updateGate(index, {
                      quantity: Number.isNaN(v) || v < 1 ? 1 : v,
                    });
                  }}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className={labelClass}>Network</label>
                <select
                  value={gate.network ?? ""}
                  onChange={(e) =>
                    updateGate(index, {
                      network: e.target.value ? e.target.value : null,
                    })
                  }
                  className={inputClass}
                >
                  <option value="">Any / Solana default</option>
                  {TOKEN_GATE_NETWORKS.map((n) => (
                    <option key={n.value} value={n.value}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className={labelClass}>
                  Contract / mint address (optional)
                </label>
                <input
                  type="text"
                  value={gate.contractAddress ?? ""}
                  onChange={(e) =>
                    updateGate(index, {
                      contractAddress: e.target.value.trim() || null,
                    })
                  }
                  className={cn(inputClass, "font-mono text-xs")}
                  placeholder="0x… or base58 mint"
                />
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addGate}>
          <Plus className="mr-2 h-4 w-4" />
          Add token gate
        </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
