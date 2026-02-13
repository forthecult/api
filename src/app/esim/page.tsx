import type { Metadata } from "next";

import { EsimStorePage } from "./esim-store-client";

export const metadata: Metadata = {
  title: "eSIM Store — Buy eSIM Data Plans for 200+ Countries",
  description:
    "Get instant mobile data with eSIM. Choose from hundreds of affordable data plans for countries and regions worldwide. No physical SIM needed.",
};

export default function EsimPage() {
  return <EsimStorePage />;
}
