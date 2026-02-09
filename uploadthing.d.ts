/** Ambient types for uploadthing (package has no .d.ts). */
declare module "uploadthing/server" {
  export class UTApi {
    constructor(opts?: { token?: string });
    deleteFiles(keys: string | string[]): Promise<{ success: boolean }>;
    getFileUrls(keys: string | string[]): Promise<{ key: string; url: string }[]>;
    listFiles(opts?: { limit?: number; cursor?: string }): Promise<unknown>;
    uploadFiles(files: File | File[]): Promise<unknown>;
  }
  export class UploadThingError extends Error {
    code: string;
  }
  export function extractRouterConfig(router: unknown): import("@uploadthing/shared").EndpointMetadata;
}

declare module "uploadthing/next" {
  export interface FileRouter {
    [key: string]: unknown;
  }
  export function createUploadthing(): (config: unknown) => any;
  export function createRouteHandler(opts: { router: unknown; config?: unknown }): {
    GET: (request: Request, context?: unknown) => Response | Promise<Response>;
    POST: (request: Request, context?: unknown) => Response | Promise<Response>;
  };
}
