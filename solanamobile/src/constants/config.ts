/**
 * App config. Override with environment (e.g. EXPO_PUBLIC_API_URL).
 */
const getEnv = (key: string, fallback: string): string => {
  // Expo injects EXPO_PUBLIC_* at build time
  const val = typeof process !== 'undefined' && process.env?.[key];
  return typeof val === 'string' && val.trim() ? val.trim() : fallback;
};

export const API_BASE_URL = getEnv('EXPO_PUBLIC_API_URL', 'http://localhost:3000');
export const SOLANA_RPC_URL = getEnv('EXPO_PUBLIC_SOLANA_RPC_URL', 'https://rpc.ankr.com/solana');
export const SOLANA_CLUSTER = 'mainnet-beta';

export const APP_IDENTITY = {
  name: 'CULT Mobile',
  uri: 'https://forthe.culture',
  icon: './assets/icon.png',
} as const;
