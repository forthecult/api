"use client";

import {
  Bot,
  Gift,
  Home,
  LineChart,
  Shirt,
  Sparkles,
} from "lucide-react";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/ui/primitives/card";

const USE_CASES = [
  {
    icon: Gift,
    title: "Gift Agents",
    description:
      "\"Find a birthday gift for a 30-year-old who loves hiking\" → curated options, ready to ship.",
  },
  {
    icon: Home,
    title: "Home Automation",
    description:
      "Smart home agents that reorder supplies when inventory runs low or trigger purchases based on events.",
  },
  {
    icon: Shirt,
    title: "Personal Stylists",
    description:
      "Fashion agents that source outfits based on style preferences, events, and weather.",
  },
  {
    icon: LineChart,
    title: "Research Agents",
    description:
      "Compare products, aggregate reviews, and surface the best options for any category.",
  },
  {
    icon: Bot,
    title: "Autonomous Assistants",
    description:
      "AI assistants that handle shopping end-to-end — from discovery to payment to delivery tracking.",
  },
  {
    icon: Sparkles,
    title: "Wellness Concierge",
    description:
      "Health-focused agents that curate supplements, longevity products, and wellness essentials.",
  },
];

export function UseCaseGallery() {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-4xl px-4">
        <div className="mb-10 text-center">
          <h2 className="font-heading mb-3 text-3xl font-bold tracking-tight sm:text-4xl">
            What Agents Can Build
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            From gift-finding to home automation — our API powers autonomous
            commerce for any use case.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((useCase) => (
            <Card className="transition-colors hover:border-primary/50" key={useCase.title}>
              <CardHeader className="pb-3">
                <div
                  className={`
                    mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10
                    text-primary
                  `}
                >
                  <useCase.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{useCase.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {useCase.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
