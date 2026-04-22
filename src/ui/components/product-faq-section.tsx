import type { ProductFaqItem } from "~/lib/product-by-slug";

export function ProductFaqSection({
  items,
}: Readonly<{ items: ProductFaqItem[] }>) {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="product-faq-heading"
      className="mt-10 border-t border-border pt-8"
    >
      <h2
        className="mb-4 text-lg font-semibold tracking-tight"
        id="product-faq-heading"
      >
        Frequently asked questions
      </h2>
      <dl className="space-y-6">
        {items.map((faq, i) => (
          <div key={`${faq.question}-${i}`}>
            <dt className="font-medium text-foreground">{faq.question}</dt>
            <dd className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {faq.answer}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
