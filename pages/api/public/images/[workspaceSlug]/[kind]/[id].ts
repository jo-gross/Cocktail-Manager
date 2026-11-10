/**
 * Public images for guest menus (no auth). Only served if the image is
 * referenced by an enabled + published unprotected menu of the workspace (or by
 * the draft of a valid `?preview=<previewToken>`). Images that only protected
 * menus use need a valid access cookie (`gma_{menuId}`) or signage token
 * (`?access=` / `X-Guest-Menu-Access`) and are sent with `Cache-Control: private`.
 *
 *   GET /api/public/images/{bar}/cocktail/{cocktailId}
 *   GET /api/public/images/{bar}/ingredient/{ingredientId}   (ingredient of a shown cocktail, not hidden)
 *   GET /api/public/images/{bar}/workspace-logo/{workspaceId}
 *   GET /api/public/images/{bar}/menu-asset/{menuId}~{logo|background|block-<blockId>}
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { createHash } from 'crypto';
import prisma from '../../../../../../prisma/prisma';
import { applyRateLimit, TokenBucketRateLimiter } from '@lib/http/rateLimit';
import { findPublicWorkspace, parseStoredDocument } from '@lib/guest-menu/server';
import { decodeImage, getImageAllowlist, getProtectedMenuImageAllowlist } from '@lib/guest-menu/public.server';
import { collectAccessTokens, createMenuAccess } from '@lib/guest-menu/access';
import { loadWorkspaceImage } from '@lib/guest-menu/workspaceImage.server';

const limiter = new TokenBucketRateLimiter({ capacity: 300, refillPerSecond: 10 });

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

async function loadImage(workspaceId: string, kind: string, id: string, allowlist: Awaited<ReturnType<typeof getImageAllowlist>>): Promise<string | null> {
  switch (kind) {
    case 'cocktail': {
      if (!allowlist.cocktailImageIds.has(id)) return null;
      const row = await prisma.cocktailRecipeImage.findFirst({ where: { cocktailRecipeId: id, cocktailRecipe: { workspaceId } }, select: { image: true } });
      return row?.image ?? null;
    }
    case 'ingredient': {
      if (allowlist.cocktailIds.size === 0) return null;
      const used = await prisma.cocktailRecipeIngredient.findFirst({
        where: { ingredientId: id, ingredient: { workspaceId, hideOnGuestMenu: false }, cocktailRecipeStep: { cocktailRecipeId: { in: [...allowlist.cocktailIds] } } },
        select: { id: true },
      });
      if (!used) return null;
      const row = await prisma.ingredientImage.findUnique({ where: { ingredientId: id }, select: { image: true } });
      return row?.image ?? null;
    }
    case 'workspace-logo': {
      if (!allowlist.workspaceLogo || id !== workspaceId) return null;
      const row = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { image: true } });
      return row?.image ?? null;
    }
    case 'menu-asset': {
      const source = allowlist.menuAssets.get(id);
      if (!source) return null;
      const [menuId, assetKey] = id.split('~', 2);
      const menu = await prisma.guestMenu.findFirst({ where: { id: menuId, workspaceId }, select: { draft: true, published: true } });
      const document = parseStoredDocument(source === 'draft' ? menu?.draft : menu?.published);
      if (!document) return null;
      if (assetKey === 'logo') return document.theme.logo ?? null;
      if (assetKey === 'background') return document.theme.backgroundImage ?? null;
      if (assetKey?.startsWith('block-')) {
        const block = document.blocks.find((candidate) => candidate.type === 'image' && candidate.id === assetKey.slice(6));
        return block?.type === 'image' ? block.src : null;
      }
      return null;
    }
    default:
      return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  if (!applyRateLimit(limiter, req, res, 'images')) return;

  const bar = first(req.query.workspaceSlug) ?? '';
  const kind = first(req.query.kind) ?? '';
  const id = first(req.query.id) ?? '';
  const previewToken = first(req.query.preview) ?? null;
  const notFound = () => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Image not found' } });

  try {
    const workspace = await findPublicWorkspace(bar);
    if (!workspace || !id) return notFound();
    const allowlist = await getImageAllowlist(workspace, previewToken);
    let raw = await loadImage(workspace.id, kind, id, allowlist);
    let isProtected = false;
    if (!raw && !previewToken) {
      const tokens = collectAccessTokens(req, req.query.access);
      if (tokens.length > 0) {
        const access = createMenuAccess(tokens);
        const menus = await prisma.guestMenu.findMany({
          where: { workspaceId: workspace.id, id: { in: [...new Set(tokens.map((token) => token.m))] }, enabled: true, accessCodeHash: { not: null } },
        });
        for (const menu of menus.filter((candidate) => access.canAccess(candidate))) {
          raw = await loadImage(workspace.id, kind, id, await getProtectedMenuImageAllowlist(workspace, menu));
          if (raw) {
            isProtected = true;
            break;
          }
        }
      }
    }
    const image = kind === 'workspace-logo' ? await loadWorkspaceImage(raw) : raw ? decodeImage(raw) : null;
    if (!image) return notFound();

    const etag = `"${createHash('sha1').update(image.bytes).digest('base64url')}"`;
    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', previewToken || isProtected ? 'private, max-age=60' : 'public, max-age=3600, stale-while-revalidate=86400');
    if (isProtected) res.setHeader('Vary', 'Cookie');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // SVG could carry scripts when opened directly – sandbox it.
    if (image.contentType === 'image/svg+xml') res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    if (req.headers['if-none-match'] === etag) return res.status(304).end();
    res.setHeader('Content-Type', image.contentType);
    res.setHeader('Content-Length', image.bytes.length);
    return res.status(200).send(image.bytes);
  } catch (error) {
    console.error('[public image]', error);
    return res.status(500).end();
  }
}
