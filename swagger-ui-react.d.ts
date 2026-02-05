declare module "swagger-ui-react" {
  import type { ComponentType } from "react";
  interface SwaggerUIProps {
    url?: string;
    spec?: object;
    [key: string]: unknown;
  }
  const SwaggerUI: ComponentType<SwaggerUIProps>;
  export default SwaggerUI;
}

declare module "@solana/web3-compat" {
  export const PublicKey: typeof import("@solana/web3.js").PublicKey;
  export const Keypair: typeof import("@solana/web3.js").Keypair;
  export const Transaction: typeof import("@solana/web3.js").Transaction;
  export const TransactionInstruction: typeof import("@solana/web3.js").TransactionInstruction;
  export const VersionedTransaction: typeof import("@solana/web3.js").VersionedTransaction;
}
