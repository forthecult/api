"use client";

import dynamic from "next/dynamic";

const TelegramStoreClient = dynamic(
  () =>
    import("~/app/telegram/TelegramStoreClient").then(
      (m) => m.TelegramStoreClient,
    ),
  { ssr: false },
);

export default function TelegramPage() {
  return <TelegramStoreClient />;
}
