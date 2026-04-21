/**
 * Resize and compress an image file for avatar use (max 384px, JPEG/WebP).
 * Reduces upload size and stored CDN payload for faster loading.
 */

const MAX_SIZE_PX = 384;
const JPEG_QUALITY = 0.88;

export async function compressAvatarImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const w = bitmap.width;
  const h = bitmap.height;
  const scale = Math.min(1, MAX_SIZE_PX / Math.max(w, h));
  const dw = Math.round(w * scale);
  const dh = Math.round(h * scale);

  const canvas = new OffscreenCanvas(dw, dh);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, dw, dh);
  bitmap.close();

  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await canvas.convertToBlob({
    quality: type === "image/jpeg" ? JPEG_QUALITY : 0.92,
    type,
  });
  if (!blob) return file;

  const name =
    file.name.replace(/\.[^.]+$/, "") +
    (type === "image/jpeg" ? ".jpg" : ".png");
  return new File([blob], name, { type });
}
