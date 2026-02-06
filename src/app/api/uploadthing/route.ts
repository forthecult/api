import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "./core";
import { getUploadThingToken } from "~/lib/uploadthing-token";

// So the SDK sees the raw token (env often has UPLOADTHING_TOKEN='...' with quotes)
const token = getUploadThingToken();
if (token) process.env.UPLOADTHING_TOKEN = token;

// Export routes for Next App Router
export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,

  // Apply an (optional) custom config:
  // config: { ... },
});
