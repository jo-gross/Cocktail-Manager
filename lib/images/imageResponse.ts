/**
 * Serving stored images. The content type is derived from the stored data URI
 * but restricted to image types, and responses carry `nosniff` plus a sandbox
 * CSP so even legacy SVGs cannot execute script on the app's origin.
 */
import type { NextApiResponse } from 'next';

export interface DecodedImage {
  contentType: string;
  bytes: Buffer;
}

/** Decodes a stored `data:image/...;base64,` value. Anything that is not an image returns null. */
export function decodeStoredImage(raw: string | null | undefined): DecodedImage | null {
  if (!raw) return null;
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/\s]+={0,2})$/i.exec(raw);
  if (!match) return null;
  const contentType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  const bytes = Buffer.from(match[2], 'base64');
  return bytes.length > 0 ? { contentType, bytes } : null;
}

export const IMAGE_RESPONSE_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  'Cross-Origin-Resource-Policy': 'same-site',
} as const;

export function sendImage(res: NextApiResponse, image: DecodedImage, cacheControl?: string) {
  res.writeHead(200, {
    ...IMAGE_RESPONSE_HEADERS,
    'Content-Type': image.contentType,
    'Content-Length': image.bytes.length,
    ...(cacheControl ? { 'Cache-Control': cacheControl } : {}),
  });
  return res.send(image.bytes);
}
