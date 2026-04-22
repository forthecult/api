"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "~/ui/primitives/button";

interface ShopApiShowcaseProps {
  apiBaseUrl: string;
}

const REQUEST_EXAMPLE = `{
  "message": "wireless noise-canceling headphones under $200",
  "context": {
    "priceRange": { "max": 200 },
    "preferences": ["good battery life", "comfortable"]
  }
}`;

const RESPONSE_EXAMPLE = `{
  "reply": "I found some great wireless noise-canceling headphones under $200...",
  "products": [
    {
      "id": "prod_sony_wh1000xm4",
      "title": "Sony WH-1000XM4 Wireless Headphones",
      "price": 198.00,
      "currency": "USD",
      "rating": 4.7,
      "reviewCount": 42531,
      "imageUrl": "https://...",
      "source": "store",
      "inStock": true,
      "badge": "bestseller"
    }
  ]
}`;

export function ShopApiShowcase({ apiBaseUrl }: ShopApiShowcaseProps) {
  const [copied, setCopied] = useState<"endpoint" | "request" | null>(null);
  const endpoint = `${apiBaseUrl}/api/agent/shop`;

  const handleCopy = async (text: string, type: "endpoint" | "request") => {
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <section className="py-16">
      <div
        className={`
          mx-auto w-full max-w-7xl px-4
          sm:px-6
          lg:px-8
        `}
      >
        <div className="mb-8 text-center">
          <h2
            className={`
              font-heading mb-3 text-3xl font-bold tracking-tight
              sm:text-4xl
            `}
          >
            SHOP API
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            For agents that prefer code over conversation. One endpoint, natural
            language in, structured products out.
          </p>
        </div>

        <div
          className={`
            mb-8 flex flex-wrap items-center justify-center gap-3
            sm:flex-nowrap
          `}
        >
          <span
            className={`
              rounded-md bg-emerald-600 px-3 py-1.5 font-mono text-sm
              font-semibold text-white
            `}
          >
            POST
          </span>
          <code
            className={`
              max-w-full min-w-0 flex-1 rounded-md border border-border bg-muted
              px-4 py-2 font-mono text-sm break-all
            `}
          >
            {endpoint}
          </code>
          <Button
            className="shrink-0"
            onClick={() => handleCopy(endpoint, "endpoint")}
            size="icon"
            variant="outline"
          >
            {copied === "endpoint" ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div
          className={`
            grid gap-6
            lg:grid-cols-2
          `}
        >
          <div className="overflow-hidden rounded-lg border border-border">
            <div
              className={`
                flex items-center justify-between border-b border-border
                bg-emerald-700 px-4 py-2
              `}
            >
              <span className="font-mono text-sm font-semibold text-white">
                REQUEST
              </span>
              <Button
                className={`
                  h-7 border-emerald-500 bg-transparent text-emerald-100
                  hover:bg-emerald-600
                `}
                onClick={() => handleCopy(REQUEST_EXAMPLE, "request")}
                size="sm"
                variant="outline"
              >
                {copied === "request" ? (
                  <>
                    <Check className="mr-1 h-3 w-3" />
                    Copied
                  </>
                ) : (
                  "Copy"
                )}
              </Button>
            </div>
            <pre
              className={`
                bg-emerald-900 p-4 font-mono text-sm leading-relaxed break-words
                whitespace-pre-wrap text-emerald-100
              `}
            >
              {REQUEST_EXAMPLE}
            </pre>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div
              className={`
                flex items-center justify-between border-b border-border
                bg-emerald-700 px-4 py-2
              `}
            >
              <span className="font-mono text-sm font-semibold text-white">
                RESPONSE
              </span>
            </div>
            <pre
              className={`
                bg-emerald-900 p-4 font-mono text-sm leading-relaxed break-words
                whitespace-pre-wrap text-emerald-100
              `}
            >
              {RESPONSE_EXAMPLE}
            </pre>
          </div>
        </div>

        <div className="mt-6 text-center">
          <a
            className={`
              font-medium text-primary underline-offset-4
              hover:underline
            `}
            href="/api/docs"
          >
            Full API Documentation →
          </a>
        </div>
      </div>
    </section>
  );
}
