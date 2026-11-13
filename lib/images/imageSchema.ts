/**
 * Validation for uploaded images. Images are stored as base64 data URIs; only
 * raster formats are accepted so a stored "image" can never be HTML/SVG/JS that
 * would run on the app's origin when served back.
 */
import { z } from '@lib/openapi/zod';

export const ALLOWED_IMAGE_MIME_TYPES = ['png', 'jpeg', 'jpg', 'gif', 'webp', 'avif', 'bmp', 'heic', 'heif', 'tiff'] as const;

/** ~7.5 MB of binary data. Clients compress to ≤ 0.5 MB before upload. */
export const MAX_IMAGE_DATA_URI_LENGTH = 10_000_000;

export const IMAGE_DATA_URI_PATTERN = new RegExp(`^data:image/(?:${ALLOWED_IMAGE_MIME_TYPES.join('|')});base64,[A-Za-z0-9+/]+={0,2}$`);

export const ImageDataUriSchema = z
  .string()
  .max(MAX_IMAGE_DATA_URI_LENGTH)
  .regex(IMAGE_DATA_URI_PATTERN, { message: 'Image must be a base64 data URI of a raster image (png, jpeg, gif, webp, avif, …)' })
  .openapi({ description: 'Base64-encoded raster image as data URI, e.g. `data:image/png;base64,…`.', example: 'data:image/png;base64,iVBORw0KGgo=' });

export function isAllowedImageDataUri(value: unknown): value is string {
  return typeof value === 'string' && value.length <= MAX_IMAGE_DATA_URI_LENGTH && IMAGE_DATA_URI_PATTERN.test(value);
}
