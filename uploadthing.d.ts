/** Ambient types for uploadthing (package has no .d.ts). */
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

declare module "uploadthing/next" {
  export type FileRouter = Record<string, unknown>;
  export function createRouteHandler(opts: {
    config?: unknown;
    router: unknown;
  }): {
    GET: (request: Request, context?: unknown) => Promise<Response> | Response;
    POST: (request: Request, context?: unknown) => Promise<Response> | Response;
  };
  export function createUploadthing(): (config: unknown) => any;
}
