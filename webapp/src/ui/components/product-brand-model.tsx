import { cn } from "~/lib/cn";

interface ProductBrandModelProps {
  brand?: null | string;
  className?: string;
  model?: null | string;
}

/** hides printful/printify placeholder brands */
export function ProductBrandModel({
  brand,
  className,
  model,
}: ProductBrandModelProps) {
  const b = brand?.trim();
  const m = model?.trim();
  const isProviderBrand =
    b?.toLowerCase() === "printful" ||
    b?.toLowerCase() === "printify" ||
    b?.toLowerCase() === "generic brand";
  if (!b && !m) return null;
  if (isProviderBrand) return null;
  return (
    <div
      className={cn(
        `
          mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm
          text-muted-foreground
        `,
        className,
      )}
    >
      {b && (
        <span>
          <span className="font-medium text-foreground">Brand:</span> {b}
        </span>
      )}
      {m && (
        <span>
          <span className="font-medium text-foreground">Model:</span> {m}
        </span>
      )}
    </div>
  );
}
