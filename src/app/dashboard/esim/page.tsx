import type { Metadata } from "next";

import { MyEsimsClient } from "./my-esims-client";

export const metadata: Metadata = {
  title: "My eSIMs",
  robots: { index: false, follow: false },
};

export default function MyEsimsPage() {
  return <MyEsimsClient />;
}
