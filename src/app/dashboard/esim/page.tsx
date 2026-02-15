import type { Metadata } from "next";

import { MyEsimsClient } from "./my-esims-client";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "My eSIMs",
};

export default function MyEsimsPage() {
  return <MyEsimsClient />;
}
