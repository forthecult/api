"use client";

import { Plus, Trash2 } from "lucide-react";

import { cn } from "~/lib/cn";
import { TOKEN_GATE_NETWORKS } from "~/lib/token-gating";
import { Button } from "~/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

export interface TokenGateRow {
  contractAddress: null | string;
  id?: string;
  network: null | string;
  quantity: number;
  tokenSymbol: string;
}

const defaultInputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const defaultLabelClass = "mb-1.5 block text-sm font-medium";

interface Props {
  description?: string;
  gates: TokenGateRow[];
  inputClass?: string;
  labelClass?: string;
  onChange: (gates: TokenGateRow[]) => void;
  onTokenGatedChange?: (v: boolean) => void;
  title?: string;
  /** When set, show a "Token gated" checkbox at the top; list and Add button only when checked */
  tokenGated?: boolean;
}

export function TokenGatesList({
  description = "Access if user holds ≥ quantity of ANY token (OR). Add rows for multiple options.",
  gates,
  inputClass = defaultInputClass,
  labelClass = defaultLabelClass,
  onChange,
  onTokenGatedChange,
  title = "Multiple token gates",
  tokenGated,
}: Props) {
  const addGate = () => {
    onChange([
      ...gates,
      {
        contractAddress: null,
        id: nextId(),
        network: "solana",
        quantity: 1000,
        tokenSymbol: "CULT",
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
              checked={tokenGated ?? false}
              className={cn(
                `
                  size-4 rounded border-input text-primary
                  focus:ring-ring
                `,
              )}
              onChange={(e) => onTokenGatedChange(e.target.checked)}
              type="checkbox"
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
                className={cn(
                  "space-y-3 rounded-lg border border-border bg-muted/30 p-4",
                )}
                key={gate.id ?? index}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Gate {index + 1}</span>
                  <Button
                    className={`
                      text-destructive
                      hover:text-destructive
                    `}
                    onClick={() => removeGate(index)}
                    size="sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div
                  className={`
                  grid gap-3
                  sm:grid-cols-2
                `}
                >
                  <div className="space-y-1">
                    <label className={labelClass}>Token symbol</label>
                    <input
                      className={inputClass}
                      onChange={(e) =>
                        updateGate(index, {
                          tokenSymbol:
                            e.target.value.trim().toUpperCase() || "",
                        })
                      }
                      placeholder="e.g. CULT, WHALE"
                      type="text"
                      value={gate.tokenSymbol}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClass}>Min quantity</label>
                    <input
                      className={inputClass}
                      min={1}
                      onChange={(e) => {
                        const v = Number.parseInt(e.target.value, 10);
                        updateGate(index, {
                          quantity: Number.isNaN(v) || v < 1 ? 1 : v,
                        });
                      }}
                      type="number"
                      value={gate.quantity}
                    />
                  </div>
                  <div
                    className={`
                    space-y-1
                    sm:col-span-2
                  `}
                  >
                    <label className={labelClass}>Network</label>
                    <select
                      className={inputClass}
                      onChange={(e) =>
                        updateGate(index, {
                          network: e.target.value ? e.target.value : null,
                        })
                      }
                      value={gate.network ?? ""}
                    >
                      <option value="">Any / Solana default</option>
                      {TOKEN_GATE_NETWORKS.map((n) => (
                        <option key={n.value} value={n.value}>
                          {n.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div
                    className={`
                    space-y-1
                    sm:col-span-2
                  `}
                  >
                    <label className={labelClass}>
                      Contract / mint address (optional)
                    </label>
                    <input
                      className={cn(inputClass, "font-mono text-xs")}
                      onChange={(e) =>
                        updateGate(index, {
                          contractAddress: e.target.value.trim() || null,
                        })
                      }
                      placeholder="0x… or base58 mint"
                      type="text"
                      value={gate.contractAddress ?? ""}
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button onClick={addGate} size="sm" type="button" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add token gate
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function nextId(): string {
  return `tg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
