/**
 * Update Minirig 4 and Minirig Subwoofer 4 in production via admin API:
 * vendor = Minirig, countryOfOrigin = United Kingdom,
 * product photos (not logos), and one photo per colour variant linked to that variant.
 *
 * Usage:
 *   MAIN_APP_URL=https://forthecult.store ADMIN_AI_API_KEY=<key> bun run scripts/update-minirig-production.ts
 */

const MAIN_APP_URL =
  process.env.MAIN_APP_URL?.trim() || "https://forthecult.store";
const API_KEY =
  process.env.ADMIN_AI_API_KEY?.trim() || process.env.ADMIN_API_KEY?.trim();
if (!API_KEY) {
  console.error(
    "Set ADMIN_AI_API_KEY or ADMIN_API_KEY. Optionally MAIN_APP_URL.",
  );
  process.exit(1);
}

const API_BASE = MAIN_APP_URL.replace(/\/$/, "");
const headers: Record<string, string> = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
};

const SITES_LARGE =
  "https://minirigs.co.uk/sites/default/files/styles/large/public/2026-01";
const SITES_12 =
  "https://minirigs.co.uk/sites/default/files/styles/large/public/2025-12";
const SITES_11 =
  "https://minirigs.co.uk/sites/default/files/styles/large/public/2025-11";

const MINIRIG_4 = {
  slug: "minirig-4-bluetooth-speaker",
  imageUrl: `${SITES_LARGE}/minirig-4-black.webp?itok=Sz1POk6h`,
  mainImageAlt:
    "Minirig 4 Bluetooth Speaker - portable wireless speaker, Bristol UK",
  mainImageTitle: "Minirig 4 Bluetooth Speaker | Portable Bluetooth Speaker",
  images: [
    {
      url: `${SITES_LARGE}/minirig-4-black.webp?itok=Sz1POk6h`,
      alt: "Minirig 4 Bluetooth Speaker Black - portable wireless speaker, designed in Bristol UK",
      title: "Minirig 4 Bluetooth Speaker - Black",
    },
    {
      url: `${SITES_LARGE}/minirig-4-black-top-cap.webp?itok=2YpnK93c`,
      alt: "Minirig 4 Black grille and top cap",
      title: "Minirig 4 - Grille",
    },
    {
      url: `${SITES_LARGE}/minirig-4-bottom-cap.webp?itok=w5op-ysf`,
      alt: "Minirig 4 bottom cap and controls",
      title: "Minirig 4 - Bottom",
    },
    {
      url: `${SITES_LARGE}/minirig-4-case-open.webp?itok=Sh4PRn1k`,
      alt: "Minirig 4 with protective travel case open",
      title: "Minirig 4 - Case open",
    },
    {
      url: `${SITES_LARGE}/minirig-4-case-closed.webp?itok=SedEPEDw`,
      alt: "Minirig 4 travel case closed",
      title: "Minirig 4 - Case closed",
    },
    {
      url: `${SITES_LARGE}/minirig-4-charger-cable.webp?itok=hnH4dDPD`,
      alt: "Minirig 4 USB-C charging cable",
      title: "Minirig 4 - Charger cable",
    },
    {
      url: `${SITES_LARGE}/minirig-4-packaging.webp?itok=Oa2kYqSz`,
      alt: "Minirig 4 eco-friendly recycled packaging",
      title: "Minirig 4 - Packaging",
    },
  ],
  variantImageByColor: {
    Black: `${SITES_LARGE}/minirig-4-black.webp?itok=Sz1POk6h`,
    Blue: `${SITES_LARGE}/minirig-4-blue.webp?itok=s7BbIhfE`,
    "Brushed Silver": `${SITES_LARGE}/minirig-4-brushed-silver.webp?itok=00TzdmUL`,
    Green: `${SITES_LARGE}/minirig-4-green.webp?itok=gik6ylsA`,
    Red: `${SITES_LARGE}/minirig-4-red.webp?itok=A4ATy2Gb`,
  },
  priceCents: 21499,
};

const MINIRIG_SUBWOOFER_4 = {
  slug: "minirig-subwoofer-4",
  imageUrl: `${SITES_12}/black-sub-4.webp?itok=6EtSzO36`,
  mainImageAlt: "Minirig Subwoofer 4 - portable wireless subwoofer, Bristol UK",
  mainImageTitle: "Minirig Subwoofer 4 | Portable Subwoofer",
  images: [
    {
      url: `${SITES_12}/black-sub-4.webp?itok=6EtSzO36`,
      alt: "Minirig Subwoofer 4 Black - portable wireless subwoofer, Bristol UK",
      title: "Minirig Subwoofer 4 - Black",
    },
    {
      url: `${SITES_12}/topview-black-sub-4.webp?itok=UQ1Hvnfd`,
      alt: "Minirig Subwoofer 4 grille top view",
      title: "Minirig Subwoofer 4 - Grille",
    },
    {
      url: `${SITES_12}/port-view-sub-4.webp?itok=wns2zoI6`,
      alt: "Minirig Subwoofer 4 port view",
      title: "Minirig Subwoofer 4 - Port",
    },
    {
      url: `${SITES_12}/Subwoofer%204%20-%20product%20-%20Mailchimp%20%281%29.png.webp?itok=QxwBrvw4`,
      alt: "Minirig Subwoofer 4 in the box",
      title: "Minirig Subwoofer 4 - In the box",
    },
  ],
  variantImageByColor: {
    Black: `${SITES_11}/black-sub-4.webp?itok=2LnqDOgl`,
    Blue: `${SITES_11}/blue-sub-4.webp?itok=4-NXIT3T`,
    "Brushed Silver": `${SITES_11}/brushed-sub-4.webp?itok=P5nxiI7f`,
    Green: `${SITES_11}/green-sub-4.webp?itok=MVoTu7Mx`,
    Purple: `${SITES_11}/purple-sub-4.webp?itok=1WQ879_q`,
    Red: `${SITES_11}/red-sub-4.webp?itok=Ac7_xGHj`,
  },
  priceCents: 22799,
};

type ProductPayload = typeof MINIRIG_4;

async function main() {
  const listRes = await fetch(
    `${API_BASE}/api/admin/products?search=Minirig&limit=20`,
    { headers },
  );
  if (!listRes.ok)
    throw new Error(`Products list: ${listRes.status} ${await listRes.text()}`);
  const listData = (await listRes.json()) as {
    items?: Array<{ id: string; slug?: string; name: string }>;
  };
  const items = listData.items ?? [];

  const bySlug: Record<string, ProductPayload> = {
    "minirig-4-bluetooth-speaker": MINIRIG_4,
    "minirig-subwoofer-4": MINIRIG_SUBWOOFER_4,
  };

  for (const product of items) {
    const slug = (product.slug ?? "").trim();
    const payload = bySlug[slug];
    if (!payload) continue;

    const getRes = await fetch(`${API_BASE}/api/admin/products/${product.id}`, {
      headers,
    });
    if (!getRes.ok) {
      console.error(`GET ${product.name}: ${getRes.status}`);
      continue;
    }
    const current = (await getRes.json()) as {
      variants?: Array<{
        id: string;
        color?: string | null;
        priceCents: number;
        sku?: string | null;
      }>;
    };
    const existingVariants = current.variants ?? [];

    const variants = existingVariants.map((v) => {
      const color = (v.color ?? "").trim();
      const imageUrl = color
        ? ((payload.variantImageByColor as Record<string, string>)[color] ??
          null)
        : null;
      return {
        id: v.id,
        color: v.color ?? null,
        priceCents: v.priceCents,
        sku: v.sku ?? null,
        imageUrl: imageUrl ?? undefined,
        imageAlt: color
          ? `Minirig ${slug.includes("subwoofer") ? "Subwoofer 4" : "4 Bluetooth Speaker"}, ${color}`
          : undefined,
        imageTitle: color
          ? slug.includes("subwoofer")
            ? `Minirig Subwoofer 4 - ${color}`
            : `Minirig 4 - ${color}`
          : undefined,
      };
    });

    const body = {
      vendor: "Minirig",
      countryOfOrigin: "United Kingdom",
      imageUrl: payload.imageUrl,
      mainImageAlt: payload.mainImageAlt,
      mainImageTitle: payload.mainImageTitle,
      images: payload.images.map((img, i) => ({
        url: img.url,
        alt: img.alt,
        title: img.title,
        sortOrder: i,
      })),
      variants,
    };

    const patchRes = await fetch(
      `${API_BASE}/api/admin/products/${product.id}`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      },
    );

    if (!patchRes.ok) {
      console.error(
        `PATCH ${product.name}: ${patchRes.status} ${await patchRes.text()}`,
      );
      continue;
    }
    console.log("Updated:", product.name);
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("Done. Minirig products updated in production.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
