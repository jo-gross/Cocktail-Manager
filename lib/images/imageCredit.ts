/**
 * Image credits: attribution of an image (title, author, source, license), e.g. for CC BY /
 * CC BY-SA photos of templates. Stored next to the image (`credit` of the image tables) and
 * shown wherever the image is displayed. Pure module (client and server).
 */
import { z } from '@lib/openapi/zod';

export const IMAGE_CREDIT_MAX_LENGTH = 1000;

/** Request field next to `image`: a string sets the credit, null/"" clears it, omitted = see {@link nextImageCredit}. */
export const ImageCreditInputSchema = z.string().max(IMAGE_CREDIT_MAX_LENGTH).nullish().openapi({
  description:
    'Attribution of the image (author, source, license), shown wherever the image is displayed. Omitted: kept while the image stays the same, cleared when a new image is uploaded; null or empty clears it.',
  example: '"Negroni" by Jane Doe, https://commons.wikimedia.org/wiki/File:Negroni.jpg, CC BY-SA 4.0',
});

export function normalizeImageCredit(credit: string | null | undefined): string | null {
  const trimmed = credit?.replace(/\s+/g, ' ').trim();
  return trimmed ? trimmed.slice(0, IMAGE_CREDIT_MAX_LENGTH) : null;
}

/**
 * Credit to store for an image write: none without an image; the given credit when the request
 * has one (null/"" clears it); otherwise the previous credit only if the image is unchanged
 * (a new upload drops the credit of the old image).
 */
export function nextImageCredit(
  input: { image: string | null | undefined; credit?: string | null },
  previous: { image: string; credit: string | null } | null | undefined,
): string | null {
  if (!input.image) return null;
  if (input.credit !== undefined) return normalizeImageCredit(input.credit);
  return previous && previous.image === input.image ? previous.credit : null;
}

/**
 * Short form for captions: `Author · License` for credits like
 * `"Title" by Author, https://…, CC BY-SA 4.0 https://…, scaled`, otherwise the (shortened) credit.
 */
export function shortImageCredit(credit: string, maxLength = 60): string {
  const author = /\bby\s+(.+?),\s*(?:https?:\/\/|via\b)/i.exec(credit)?.[1] ?? /©\s*([^,]+)/.exec(credit)?.[1];
  const license = /\b(CC0(?: 1\.0)?|CC BY(?:-SA|-ND|-NC)*(?: \d\.\d)?|Public Domain)\b/i.exec(credit)?.[1];
  const short = author ? [author.trim(), license].filter(Boolean).join(' · ') : credit;
  return short.length > maxLength ? `${short.slice(0, maxLength - 1).trimEnd()}…` : short;
}

/** First http(s) URL of a credit (source page of the image), or null. */
export function imageCreditUrl(credit: string): string | null {
  const url = /https?:\/\/[^\s,]+/.exec(credit)?.[0];
  return url ?? null;
}
