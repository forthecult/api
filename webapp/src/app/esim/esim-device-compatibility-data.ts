/**
 * eSIM compatible devices by category. Used by the device compatibility modal on the eSIM store.
 */

export interface DeviceCategoryContent {
  devices: string[];
  incompatibility?: string;
  note?: string;
}

export const ESIM_DEVICE_CATEGORIES: Record<string, DeviceCategoryContent> = {
  apple: {
    devices: [
      "iPhone XR, XS, XS Max",
      "iPhone 11, 11 Pro",
      "iPhone SE 2 (2020), SE 3 (2022)",
      "iPhone 12, 12 Mini, 12 Pro, 12 Pro Max",
      "iPhone 13, 13 Mini, 13 Pro, 13 Pro Max",
      "iPhone 14, 14 Plus, 14 Pro, 14 Pro Max",
      "iPhone 15, 15 Plus, 15 Pro, 15 Pro Max",
      "iPhone 16, 16 Plus, 16 Pro, 16 Pro Max",
      "iPhone 17, 17 Air, 17 Pro, 17 Pro Max",
      'iPads with eSIM (4G/5G only): iPad Pro 11" (2020 onwards), iPad Pro 12.9" (2020 onwards), iPad Air (2019 onwards, including M2), iPad Mini (2019 onwards), iPad (2019 onwards, including 10th generation)',
    ],
    incompatibility:
      "*iPhones from mainland China and iPhone devices from Hong Kong and Macao (except for iPhone 13 mini, iPhone 12 mini, iPhone SE 2020, and iPhone XS) don't have eSIM compatibility. *iPhone 14, iPhone 14 Plus, iPhone 14 Pro, and iPhone 14 Pro Max are not compatible with physical SIM cards in the USA.",
    note: "On iPhone 13, 14 and 15 models, you can have two eSIMs activated at the same time.",
  },
  google: {
    devices: [
      "Google Pixel 2 XL (Google Fi only)",
      "Google Pixel 3, 3XL, 3a, 3a XL",
      "Google Pixel 4, 4XL, 4a",
      "Google Pixel 5, 5a",
      "Google Pixel 6, 6a, 6 Pro",
      "Google Pixel 7, 7 Pro",
      "Google Pixel 8, 8a, 8 Pro",
      "Google Pixel 9, 9 Pro, 9 Pro XL, 9a",
      "Google Pixel 10, 10 Pro, 10 Pro XL",
      "Google Pixel Fold",
    ],
    incompatibility:
      "*Google Pixel 3 devices from Australia, Japan, and Taiwan are not compatible with eSIM. *Google Pixel 3a from South East Asia is not compatible with eSIM.",
  },
  huawei: {
    devices: [
      "Huawei P40, P40 Pro",
      "Huawei Mate 40 Pro",
      "Huawei Pura 70 Pro",
    ],
    incompatibility:
      "*The Huawei P40 Pro+ and P50 Pro are not compatible with eSIM.",
  },
  laptops: {
    devices: [
      "Microsoft Surface Pro X, Surface Pro 9, Surface Go 2, Surface Go 3, Surface Duo 2, Surface Laptop series",
      "Acer Swift 3, Swift 7, TravelMate P2, Spin P4, P6",
      "Asus Mini Transformer, NovaGo, VivoBook Flip 14",
      "Dell Latitude 5310, 5410, 5511, 7310, 7410, 9510, 9410",
      "HP EliteBook G5, ProBook G5, ZBook G5, Spectre Folio 13",
      "Lenovo Yoga C630, Miix 630, Yoga 520, ThinkPad X1 (Carbon, Titanium Yoga, Nano), X12 Detachable, Flex 5G",
      "Samsung Galaxy Book 2, Book 3, Book 4, Book 5",
    ],
  },
  motorola: {
    devices: [
      "Motorola Razr 2019, Razr 5G",
      "Motorola Razr 40, Razr 40 Ultra, Razr+ (2024), Razr 50 Ultra",
      "Motorola Edge 40, Edge 40 Pro, Edge 40 Neo",
      "Motorola Edge 50 Pro, Ultra, Fusion",
      "Moto G Stylus 5G (2024)",
    ],
  },
  oppo: {
    devices: [
      "Oppo Find X3 Pro, Find X5, Find X5 Pro",
      "Oppo Find X8, Find X8 Pro",
      "Oppo Find N2 Flip, Find N3, Find N3 Flip",
      "Oppo Reno 5A, Reno 6 Pro 5G, Reno 9A",
    ],
    incompatibility: "*The Oppo Find X5 Lite is not compatible.",
  },
  other: {
    devices: [
      "Sony Xperia 10 III Lite, 10 IV, 10 V, 10 VI",
      "Sony Xperia 1 IV, 1 V, 1 VI",
      "Honor Magic 4 Pro, Magic 5 Pro, Magic 6 Pro, Magic 7 Pro",
      "Honor Magic V2, V3",
      "Fairphone 4, Fairphone 5",
      "Sharp Aquos Sense6s, Aquos Wish, Aquos Sense7, Sense7+, Sense8",
      "Sharp Aquos R7, R8, R8 Pro",
      "OnePlus Open, 11, 11 5G, 12, 13",
      "Vivo V29, V29 Lite, V40, V40 SE, V40 Lite",
      "Vivo X80 Pro, X90 Pro, X100 Pro, X200, X200 Pro",
      "Nokia XR21, X30, G60 5G",
      "ZTE Nubia Flip 5G",
      "Gemini PDA",
      "Rakuten Mini, Big-S, Big, Hand, Hand 5G",
      "DOOGEE V30",
      "Solana Mobile Seeker",
    ],
  },
  samsung: {
    devices: [
      "Galaxy S20 through S25, S25 Edge",
      "Note 20, Note 20 Ultra 5G",
      "Galaxy Fold, Galaxy Z Fold2 5G through Fold7",
      "Galaxy Z Flip, Flip3 5G through Flip7",
      "Galaxy Tab S9, S9+, S9 Ultra, S9 FE, S10+, S10 Ultra",
      "Galaxy Book 2, Book 3, Book 4, Book 5",
    ],
    incompatibility:
      "Samsung Galaxy S20 FE 4G/5G, Samsung S20/S21 (US versions), Galaxy Z Flip 5G (US versions), Samsung Note 20 Ultra (US and Hong Kong versions), Samsung Galaxy Z Fold 2 (US and Hong Kong versions) are not compatible with eSIM.",
  },
  xiaomi: {
    devices: [
      "Xiaomi 12T Pro",
      "Xiaomi 13T, 13T Pro",
      "Xiaomi 14, 14 Pro",
      "Xiaomi 15, 15 Ultra",
      "Redmi Note 13 Pro, Note 13 Pro+",
    ],
  },
};

export const ESIM_DEVICE_CATEGORY_LABELS: Record<string, string> = {
  apple: "Apple/iOS devices",
  google: "Google devices",
  huawei: "Huawei devices",
  laptops: "Laptop and Notebooks",
  motorola: "Motorola devices",
  oppo: "Oppo devices",
  other: "Other devices",
  samsung: "Samsung devices",
  xiaomi: "Xiaomi devices",
};
