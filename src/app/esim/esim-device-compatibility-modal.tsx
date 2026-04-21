"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";

import {
  type DeviceCategoryContent,
  ESIM_DEVICE_CATEGORIES,
  ESIM_DEVICE_CATEGORY_LABELS,
} from "~/app/esim/esim-device-compatibility-data";
import { cn } from "~/lib/cn";
import { Dialog, DialogContent, DialogTitle } from "~/ui/primitives/dialog";

const IMPORTANT_NOTE =
  "Important: your phone or device must also be carrier-unlocked to use eSIM.";

export interface EsimDeviceCompatibilityModalProps {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}

function CategoryAccordionItem({
  categoryId,
  content,
  defaultOpen = false,
  label,
}: {
  categoryId: string;
  content: DeviceCategoryContent;
  defaultOpen?: boolean;
  label: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div
      className={`
        border-b border-border
        last:border-b-0
      `}
    >
      <button
        aria-expanded={open}
        className={cn(
          "flex w-full items-center justify-between py-4 text-left font-medium",
          `
            text-[#14532d]
            dark:text-emerald-400
          `,
        )}
        onClick={() => setOpen((o) => !o)}
        type="button"
      >
        <span>{label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform",
            open && `rotate-180`,
          )}
        />
      </button>
      {open && (
        <div className="pb-4 text-sm text-muted-foreground">
          <p className="mb-3 font-medium text-foreground">{IMPORTANT_NOTE}</p>
          <ul className="list-inside list-disc space-y-1">
            {content.devices.map((line, i) => (
              <li key={`${categoryId}-${i}`}>{line}</li>
            ))}
          </ul>
          {content.note && (
            <p className="mt-3 text-muted-foreground">{content.note}</p>
          )}
          {content.incompatibility && (
            <p className="mt-2 text-xs text-muted-foreground">
              {content.incompatibility}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const CATEGORY_ORDER = [
  "apple",
  "samsung",
  "google",
  "huawei",
  "oppo",
  "xiaomi",
  "motorola",
  "laptops",
  "other",
] as const;

export function EsimDeviceCompatibilityModal({
  onOpenChange,
  open,
}: EsimDeviceCompatibilityModalProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className={`
          max-h-[85vh] max-w-2xl overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogTitle
          className={cn(
            "pr-10 text-xl font-semibold",
            `
              text-[#14532d]
              dark:text-emerald-400
            `,
          )}
        >
          eSIM Compatible Devices
        </DialogTitle>
        <div className="mt-2">
          {CATEGORY_ORDER.map((id, index) => {
            const content = ESIM_DEVICE_CATEGORIES[id];
            const label = ESIM_DEVICE_CATEGORY_LABELS[id];
            if (!content || !label) return null;
            return (
              <CategoryAccordionItem
                categoryId={id}
                content={content}
                defaultOpen={index === 0}
                key={id}
                label={label}
              />
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
