/** Narrow augmentations only — prefer package .d.ts for uploadthing/next. */
declare module "uploadthing/server" {
  export class UploadThingError extends Error {
    code: string;
  }
  export class UTApi {
    constructor(opts?: { token?: string });
    deleteFiles(keys: string | string[]): Promise<{ success: boolean }>;
    getFileUrls(
      keys: string | string[],
    ): Promise<{ key: string; url: string }[]>;
    listFiles(opts?: { cursor?: string; limit?: number }): Promise<unknown>;
    uploadFiles(files: File | File[]): Promise<unknown>;
  }
  export function extractRouterConfig(
    router: unknown,
  ): import("@uploadthing/shared").EndpointMetadata;
}
