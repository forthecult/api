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

type Props = {
  tokenGated: boolean;
  tokenGateType: TokenGateType | null;
  tokenGateQuantity: number | null;
  tokenGateNetwork: string | null;
  tokenGateContractAddress: string | null;
  onTokenGatedChange: (v: boolean) => void;
  onTokenGateTypeChange: (v: TokenGateType) => void;
  onTokenGateQuantityChange: (v: number | null) => void;
  onTokenGateNetworkChange: (v: string | null) => void;
  onTokenGateContractAddressChange: (v: string | null) => void;
  inputClass?: string;
  labelClass?: string;
};

export function TokenGatingSection({
  tokenGated,
  tokenGateType,
  tokenGateQuantity,
  tokenGateNetwork,
  tokenGateContractAddress,
  onTokenGatedChange,
  onTokenGateTypeChange,
  onTokenGateQuantityChange,
  onTokenGateNetworkChange,
  onTokenGateContractAddressChange,
  inputClass = defaultInputClass,
  labelClass = defaultLabelClass,
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
            type="checkbox"
            checked={tokenGated}
            onChange={(e) => onTokenGatedChange(e.target.checked)}
            className={cn(
              "size-4 rounded border-input text-primary focus:ring-ring",
            )}
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
                    key={opt.value}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="tokenGateType"
                      value={opt.value}
                      checked={(tokenGateType ?? "") === opt.value}
                      onChange={() => onTokenGateTypeChange(opt.value)}
                      className="size-4 border-input text-primary focus:ring-ring"
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {tokenGateType === "cult_custom" && (
              <div className="space-y-2">
                <label htmlFor="tokenGateQuantity" className={labelClass}>
                  Minimum CULT quantity
                </label>
                <input
                  id="tokenGateQuantity"
                  type="number"
                  min={1}
                  value={quantityInputValue}
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
                  className={inputClass}
                  placeholder="e.g. 1000"
                />
              </div>
            )}

            {tokenGateType === "other" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="tokenGateNetwork" className={labelClass}>
                    Network
                  </label>
                  <select
                    id="tokenGateNetwork"
                    value={tokenGateNetwork ?? ""}
                    onChange={(e) =>
                      onTokenGateNetworkChange(
                        e.target.value ? e.target.value : null,
                      )
                    }
                    className={inputClass}
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
                    htmlFor="tokenGateContractAddress"
                    className={labelClass}
                  >
                    Token contract address
                  </label>
                  <input
                    id="tokenGateContractAddress"
                    type="text"
                    value={tokenGateContractAddress ?? ""}
                    onChange={(e) =>
                      onTokenGateContractAddressChange(
                        e.target.value.trim() || null,
                      )
                    }
                    className={cn(inputClass, "font-mono text-xs")}
                    placeholder="0x… or base58…"
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor="tokenGateQuantityOther"
                    className={labelClass}
                  >
                    Minimum quantity (optional)
                  </label>
                  <input
                    id="tokenGateQuantityOther"
                    type="number"
                    min={1}
                    value={quantityInputValue}
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
                    className={inputClass}
                    placeholder="e.g. 100"
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
