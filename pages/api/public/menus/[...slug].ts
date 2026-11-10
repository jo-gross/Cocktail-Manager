/**
 * Public guest menu JSON (no auth).
 *
 *   GET  /api/public/menus/{bar}                 → active menu
 *   GET  /api/public/menus/{bar}/{menuSlug}      → specific menu (notice/redirect when inactive)
 *   POST /api/public/menus/{bar}/{menuSlug}/unlock  { code, returnTo? } (JSON or form) → access cookie
 *   Query: ?lang=<content locale>  ?output=web|monitor|print  ?preview=<previewToken>  ?access=<signage token>
 *
 * 200 { status: 'ok' | 'inactive', menu: { dto, rendered } | null, notice: PublicMenuNotice | null, isPreview }
 * 200 { status: 'redirect', location }   404 { status: 'notFound' | 'noMenu', barPath }
 * 403 { status: 'locked', lock: { title, logoUrl, numeric, unlockPath } } – access code required
 * ETag + `Cache-Control: public, max-age=60, stale-while-revalidate=300` (previews/protected: private, no-store).
 * Rate limited per IP (token bucket, 429 + Retry-After); unlock: 5 attempts/min per IP + menu.
 *
 * Unlock responses – JSON: 200 { status: 'ok', location } | 401 { status: 'invalid' } | 429 { status: 'rateLimited', retryAfterSeconds };
 * form posts (`application/x-www-form-urlencoded`): 303 to `returnTo` (on error with `?error=invalid|rateLimited`).
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash } from 'crypto';
import { applyRateLimit, TokenBucketRateLimiter } from '@lib/http/rateLimit';
import prisma from '../../../../prisma/prisma';
import { loadPublicMenu } from '@lib/guest-menu/public.server';
import { findPublicWorkspace } from '@lib/guest-menu/server';
import { getBarSlug } from '@lib/guest-menu/resolve';
import { appendUnlockQuery, attemptUnlock, collectAccessTokens, createMenuAccess, sanitizeReturnTo } from '@lib/guest-menu/access';
import { GUEST_MENU_OUTPUTS, type GuestMenuOutput } from '@lib/guest-menu/schema';

const limiter = new TokenBucketRateLimiter({ capacity: 60, refillPerSecond: 1 });

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function unlock(req: NextApiRequest, res: NextApiResponse, bar: string, menuSlug: string) {
  res.setHeader('Cache-Control', 'no-store');
  const contentType = (req.headers['content-type'] ?? '').toLowerCase();
  const isForm = contentType.startsWith('application/x-www-form-urlencoded') || contentType.startsWith('multipart/form-data');
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as { code?: unknown; returnTo?: unknown };
  const code = typeof body.code === 'string' ? body.code : '';

  const workspace = await findPublicWorkspace(bar);
  const menu = workspace ? await prisma.guestMenu.findFirst({ where: { workspaceId: workspace.id, slug: menuSlug } }) : null;
  if (!workspace || !menu || menu.published == null) return res.status(404).json({ status: 'notFound' });
  const menuPath = `/m/${encodeURIComponent(getBarSlug(workspace))}/${encodeURIComponent(menu.slug)}`;
  const returnTo = sanitizeReturnTo(body.returnTo, menuPath);

  if (!menu.accessCodeHash) return isForm ? res.redirect(303, appendUnlockQuery(returnTo, {})) : res.status(200).json({ status: 'ok', location: returnTo });

  const result = await attemptUnlock(req, menu, code);
  if (result.ok) {
    res.setHeader('Set-Cookie', result.cookie);
    return isForm ? res.redirect(303, appendUnlockQuery(returnTo, {})) : res.status(200).json({ status: 'ok', location: returnTo });
  }
  if (result.reason === 'rateLimited') {
    res.setHeader('Retry-After', String(result.retryAfterSeconds ?? 60));
    if (isForm) return res.redirect(303, appendUnlockQuery(returnTo, { error: 'rateLimited', retry: String(result.retryAfterSeconds ?? 60) }));
    return res.status(429).json({ status: 'rateLimited', retryAfterSeconds: result.retryAfterSeconds ?? 60 });
  }
  return isForm ? res.redirect(303, appendUnlockQuery(returnTo, { error: 'invalid' })) : res.status(401).json({ status: 'invalid' });
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const slug = Array.isArray(req.query.slug) ? req.query.slug : [];
  if (slug.length === 3 && slug[2] === 'unlock') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
    }
    if (!applyRateLimit(limiter, req, res, 'menus')) return;
    try {
      return await unlock(req, res, slug[0], slug[1]);
    } catch (error) {
      console.error('[public menu unlock]', error);
      return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal error occurred!' } });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' } });
  }
  if (!applyRateLimit(limiter, req, res, 'menus')) return;

  if (slug.length < 1 || slug.length > 2) return res.status(404).json({ status: 'notFound', barPath: null });
  const outputParam = first(req.query.output);
  const output = GUEST_MENU_OUTPUTS.includes(outputParam as GuestMenuOutput) ? (outputParam as GuestMenuOutput) : 'web';
  const previewToken = first(req.query.preview) ?? null;

  try {
    const access = createMenuAccess(collectAccessTokens(req, req.query.access));
    const result = await loadPublicMenu({ bar: slug[0], menuSlug: slug[1] ?? null, locale: first(req.query.lang) ?? null, output, previewToken, access });
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('Vary', 'Accept-Encoding, Cookie, X-Guest-Menu-Access');

    if (result.kind === 'notFound') return res.status(404).json({ status: 'notFound', barPath: result.barPath });
    if (result.kind === 'noMenu') {
      res.setHeader('Cache-Control', 'public, max-age=30');
      return res.status(404).json({ status: 'noMenu', barPath: result.barPath });
    }
    if (result.kind === 'locked') {
      res.setHeader('Cache-Control', 'private, no-store');
      const { title, logoUrl, numeric, unlockPath } = result.lock;
      return res.status(403).json({ status: 'locked', lock: { title, logoUrl, numeric, unlockPath } });
    }
    if (result.kind === 'redirect') {
      res.setHeader('Cache-Control', 'public, max-age=30');
      return res.status(200).json({ status: 'redirect', location: result.location });
    }

    const body = JSON.stringify({ status: result.notice ? 'inactive' : 'ok', menu: result.menu ? { dto: result.menu.dto, rendered: result.menu.rendered } : null, notice: result.notice, isPreview: result.isPreview });
    const etag = `W/"${createHash('sha1').update(body).digest('base64url')}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', result.isPreview || result.isProtected ? 'private, no-store' : 'public, max-age=60, stale-while-revalidate=300');
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.status(200).send(body);
  } catch (error) {
    console.error('[public menu]', error);
    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Internal error occurred!' } });
  }
}
