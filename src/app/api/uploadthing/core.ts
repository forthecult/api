import { createId } from "@paralleldrive/cuid2";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError, UTApi } from "uploadthing/server";

import { db } from "~/db";
import { uploadsTable } from "~/db/schema";
import { auth } from "~/lib/auth";
import { getUploadThingToken } from "~/lib/uploadthing-token";
import { assertVirusTotalConfigured, scanFileUrl } from "~/lib/virus-scan";

// m6: fail boot in prod if virustotal isn't configured — we rely on it for
// malware scanning user-uploaded images + videos.
assertVirusTotalConfigured();

const f = createUploadthing();

/**
 * m6: scan a freshly-uploaded file and, if vt flags it, delete it from
 * uploadthing before rejecting the upload.
 */
async function scanAndMaybeDelete(
  file: { key: string; ufsUrl: string },
  maxBytes: number,
): Promise<void> {
  const scan = await scanFileUrl(file.ufsUrl, { maxBytes });
  if (scan.ok) return;
  const token = getUploadThingToken();
  if (token) {
    try {
      const utapi = new UTApi({ token });
      await utapi.deleteFiles(file.key);
    } catch {
      // best-effort delete — upload is being rejected either way.
    }
  }
  throw new UploadThingError(
    `File rejected: ${scan.error}. Please upload a different file.`,
  );
}

const AVATAR_MAX_SIZE = "1MB";
export const ourFileRouter = {
  avatarUploader: f({
    "image/gif": { maxFileCount: 1, maxFileSize: AVATAR_MAX_SIZE },
    "image/jpeg": { maxFileCount: 1, maxFileSize: AVATAR_MAX_SIZE },
    "image/png": { maxFileCount: 1, maxFileSize: AVATAR_MAX_SIZE },
    "image/webp": { maxFileCount: 1, maxFileSize: AVATAR_MAX_SIZE },
  })
    .middleware(async ({ req }: { req: { headers: Headers } }) => {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session?.user?.id) throw new UploadThingError("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(
      async ({
        file,
        metadata,
      }: {
        file: { key: string; ufsUrl: string };
        metadata: { userId: string };
      }) => {
        await scanAndMaybeDelete(file, 2 * 1024 * 1024);

        return {
          fileKey: file.key,
          fileUrl: file.ufsUrl,
          uploadedBy: metadata.userId,
        };
      },
    ),

  imageUploader: f({
    "image/gif": {
      maxFileCount: 10,
      maxFileSize: "4MB",
    },
    "image/jpeg": {
      maxFileCount: 10,
      maxFileSize: "4MB",
    },
    "image/png": {
      maxFileCount: 10,
      maxFileSize: "4MB",
    },
    "image/webp": {
      maxFileCount: 10,
      maxFileSize: "4MB",
    },
  })
    .middleware(async ({ req }: { req: { headers: Headers } }) => {
      const session = await auth.api.getSession({ headers: req.headers });

      if (!session?.user?.id) throw new UploadThingError("Unauthorized");

      return { userId: session.user.id };
    })
    .onUploadComplete(
      async ({
        file,
        metadata,
      }: {
        file: { key: string; ufsUrl: string };
        metadata: { userId: string };
      }) => {
        console.log("Upload complete for userId (image):", metadata.userId);
        console.log("file url", file.ufsUrl);
        console.log("file key", file.key);

        // m6: scan before recording in the db so malware-flagged uploads never
        // become user-visible URLs.
        await scanAndMaybeDelete(file, 4 * 1024 * 1024);

        try {
          await db.insert(uploadsTable).values({
            id: createId(),
            key: file.key,
            type: "image",
            url: file.ufsUrl,
            userId: metadata.userId,
          });
          console.log(
            "Saved image upload details to database for userId:",
            metadata.userId,
          );
        } catch (error) {
          console.error(
            "Failed to save image upload details to database:",
            error,
          );
          throw new UploadThingError("Failed to process upload metadata.");
        }

        return {
          fileKey: file.key,
          fileUrl: file.ufsUrl,
          uploadedBy: metadata.userId,
        };
      },
    ),

  videoUploader: f({
    video: { maxFileCount: 5, maxFileSize: "64MB" },
  })
    .middleware(async ({ req }: { req: { headers: Headers } }) => {
      const session = await auth.api.getSession({ headers: req.headers });
      if (!session?.user?.id) throw new UploadThingError("Unauthorized");
      return { userId: session.user.id };
    })
    .onUploadComplete(
      async ({
        file,
        metadata,
      }: {
        file: { key: string; ufsUrl: string };
        metadata: { userId: string };
      }) => {
        console.log("Upload complete for userId (video):", metadata.userId);
        console.log("file url", file.ufsUrl);
        console.log("file key", file.key);

        // m6: larger cap for videos — vt free tier tops out around 32mb, so
        // anything bigger is pass-through with a warn log inside scanFileUrl.
        await scanAndMaybeDelete(file, 32 * 1024 * 1024);

        try {
          await db.insert(uploadsTable).values({
            id: createId(),
            key: file.key,
            type: "video",
            url: file.ufsUrl,
            userId: metadata.userId,
          });
          console.log(
            "Saved video upload details to database for userId:",
            metadata.userId,
          );
        } catch (error) {
          console.error(
            "Failed to save video upload details to database:",
            error,
          );
          throw new UploadThingError("Failed to process upload metadata.");
        }

        return {
          fileKey: file.key,
          fileUrl: file.ufsUrl,
          uploadedBy: metadata.userId,
        };
      },
    ),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
