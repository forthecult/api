"use client";

import { cn } from "~/lib/cn";
import {
  TOKEN_GATE_NETWORKS,
  TOKEN_GATE_TYPES,
  type TokenGateType,
} from "~/lib/token-gating";
import { Card, CardContent, CardHeader, CardTitle } from "~/ui/card";

const defaultInputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const defaultLabelClass = "mb-1.5 block text-sm font-medium";

interface Props {
  inputClass?: string;
  labelClass?: string;
  onTokenGateContractAddressChange: (v: null | string) => void;
  onTokenGatedChange: (v: boolean) => void;
  onTokenGateNetworkChange: (v: null | string) => void;
  onTokenGateQuantityChange: (v: null | number) => void;
  onTokenGateTypeChange: (v: TokenGateType) => void;
  tokenGateContractAddress: null | string;
  tokenGated: boolean;
  tokenGateNetwork: null | string;
  tokenGateQuantity: null | number;
  tokenGateType: null | TokenGateType;
}

export function TokenGatingSection({
  inputClass = defaultInputClass,
  labelClass = defaultLabelClass,
  onTokenGateContractAddressChange,
  onTokenGatedChange,
  onTokenGateNetworkChange,
  onTokenGateQuantityChange,
  onTokenGateTypeChange,
  tokenGateContractAddress,
  tokenGated,
  tokenGateNetwork,
  tokenGateQuantity,
  tokenGateType,
}: Props) {
  const quantityInputValue =
    tokenGateQuantity != null ? String(tokenGateQuantity) : "";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Token gating</CardTitle>
        <p className="text-sm text-muted-foreground">
          Require users to hold a minimum amount of a token to access this
          category or product.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <label className="flex items-center gap-2">
          <input
            checked={tokenGated}
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

        {tokenGated && (
          <>
            <div className="space-y-2">
              <span className={labelClass}>Token type</span>
              <div className="space-y-2">
                {TOKEN_GATE_TYPES.map((opt) => (
                  <label
                    className="flex cursor-pointer items-center gap-2"
                    key={opt.value}
                  >
                    <input
                      checked={(tokenGateType ?? "") === opt.value}
                      className={`
                        size-4 border-input text-primary
                        focus:ring-ring
                      `}
                      name="tokenGateType"
                      onChange={() => onTokenGateTypeChange(opt.value)}
                      type="radio"
                      value={opt.value}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {tokenGateType === "cult_custom" && (
              <div className="space-y-2">
                <label className={labelClass} htmlFor="tokenGateQuantity">
                  Minimum CULT quantity
                </label>
                <input
                  className={inputClass}
                  id="tokenGateQuantity"
                  min={1}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    if (v === "") {
                      onTokenGateQuantityChange(null);
                      return;
                    }
                    const n = Number.parseInt(v, 10);
                    onTokenGateQuantityChange(
                      Number.isNaN(n) || n < 1 ? null : n,
                    );
                  }}
                  placeholder="e.g. 1000"
                  type="number"
                  value={quantityInputValue}
                />
              </div>
            )}

            {tokenGateType === "other" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className={labelClass} htmlFor="tokenGateNetwork">
                    Network
                  </label>
                  <select
                    className={inputClass}
                    id="tokenGateNetwork"
                    onChange={(e) =>
                      onTokenGateNetworkChange(
                        e.target.value ? e.target.value : null,
                      )
                    }
                    value={tokenGateNetwork ?? ""}
                  >
                    <option value="">Select network</option>
                    {TOKEN_GATE_NETWORKS.map((n) => (
                      <option key={n.value} value={n.value}>
                        {n.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label
                    className={labelClass}
                    htmlFor="tokenGateContractAddress"
                  >
                    Token contract address
                  </label>
                  <input
                    className={cn(inputClass, "font-mono text-xs")}
                    id="tokenGateContractAddress"
                    onChange={(e) =>
                      onTokenGateContractAddressChange(
                        e.target.value.trim() || null,
                      )
                    }
                    placeholder="0x… or base58…"
                    type="text"
                    value={tokenGateContractAddress ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    className={labelClass}
                    htmlFor="tokenGateQuantityOther"
                  >
                    Minimum quantity (optional)
                  </label>
                  <input
                    className={inputClass}
                    id="tokenGateQuantityOther"
                    min={1}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      if (v === "") {
                        onTokenGateQuantityChange(null);
                        return;
                      }
                      const n = Number.parseInt(v, 10);
                      onTokenGateQuantityChange(
                        Number.isNaN(n) || n < 1 ? null : n,
                      );
                    }}
                    placeholder="e.g. 100"
                    type="number"
                    value={quantityInputValue}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
