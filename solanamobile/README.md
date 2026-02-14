# CULT Solana Mobile

Native Android app (Expo + React Native) using the [Solana Mobile Wallet Adapter](https://docs.solanamobile.com/react-native/quickstart). Connects to the existing Relivator Next.js API.

## Scope (current)

- **Included:** Wallet connection (MWA), Sign-In With Solana, API client layer (auth, products, checkout, governance, esim, support), navigation (Shop, Governance, eSIM, Dashboard), placeholder screens. No staking UI and no final design yet.
- **Deferred:** Staking/voting UI, full checkout/eSIM flows, polish and visual design (to be done after web app front-end is finished).

## Setup

1. From `relivator/`: `cd solanamobile && npm install`
2. Create `.env` (or set in app config):
   - `EXPO_PUBLIC_API_URL` – base URL of the Next.js app (e.g. `http://localhost:3000` or your deployed URL)
   - Optional: `EXPO_PUBLIC_SOLANA_RPC_URL`, `EXPO_PUBLIC_CULT_MINT`, `EXPO_PUBLIC_STAKING_PROGRAM_ID`
3. Run: `npm start` then press `a` for Android, or `npx expo run:android` for a dev build.

## Build APK

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

APK: `android/app/build/outputs/apk/release/app-release.apk`.

## Project layout

- `src/providers/` – MobileWalletProvider (MWA), AuthProvider (SIWS + session)
- `src/api/` – Typed API client for auth, products, checkout, governance, esim, support
- `src/navigation/` – Root stack, tab navigator (Shop, Governance, eSIM, Dashboard)
- `src/screens/` – Placeholder/skeleton screens (design TBD)
- `src/constants/` – API URL, RPC, app identity, token/program IDs
