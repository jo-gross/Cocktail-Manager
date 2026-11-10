/**
 * Signage slide of type `GUEST_MENU`: loads the menu from the public JSON API
 * (`output=monitor`), polls every 60 s with `If-None-Match` and renders it with
 * `GuestMenuMonitorView`. Protected menus: the signage access tokens of the slide
 * (`guestMenuAccessTokens`, refreshed by the signage poll) are sent as
 * `X-Guest-Menu-Access`; image URLs of the payload already carry `?access=`.
 *
 * Paging: a menu slide stays on screen for all of its pages
 * (`pageDurationSeconds` each) and calls `onComplete` after the last page – so
 * a long menu is never cut off by the format's slide duration. With
 * `localeMode: rotate` the language advances after every full page cycle.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GuestMenuMonitorView, type GuestMenuMonitorFormat } from '@components/guest-menu/monitor/GuestMenuMonitorView';
import type { PublicMenuDto } from '@lib/guest-menu/schema';
import type { RenderedMenu } from '@lib/guest-menu/render';
import { getPublicMenuUrl } from '@lib/network/guestMenus';
import type { SignageSlideView } from '@lib/signage/types';

const POLL_INTERVAL_MS = 60_000;

interface MenuPayload {
  dto: PublicMenuDto;
  rendered: RenderedMenu;
}

interface CacheEntry {
  etag: string | null;
  /** `null` = no menu to show (inactive, not found, …). */
  payload: MenuPayload | null;
}

export interface GuestMenuSlideProps {
  workspaceId: string;
  slide: Pick<SignageSlideView, 'id' | 'guestMenuId' | 'guestMenuSlug' | 'guestMenuAccessTokens' | 'options'>;
  format: GuestMenuMonitorFormat;
  /** Currently shown slide: drives the page timer. */
  active: boolean;
  /** Page duration when neither the slide nor the menu define one. */
  fallbackPageDurationSeconds: number;
  /** All pages were shown once. */
  onComplete: () => void;
  /** `false` while the menu cannot be shown (the display skips the slide). */
  onAvailabilityChange?: (slideId: string, available: boolean) => void;
}

export function GuestMenuSlide({ workspaceId, slide, format, active, fallbackPageDurationSeconds, onComplete, onAvailabilityChange }: GuestMenuSlideProps) {
  const options = slide.options ?? {};
  const [entries, setEntries] = useState<Record<string, CacheEntry>>({});
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [cycle, setCycle] = useState(0);
  const [wasActive, setWasActive] = useState(active);
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  // Start at the first page whenever the slide comes on screen.
  if (active !== wasActive) {
    setWasActive(active);
    if (active) setPage(0);
  }

  const anyPayload = useMemo(() => Object.values(entries).find((entry) => entry.payload)?.payload ?? null, [entries]);
  const localeMode = options.localeMode ?? anyPayload?.dto.monitor?.localeMode ?? 'primary';
  const availableLocales = anyPayload?.dto.availableLocales ?? [];

  let locale: string | null = null;
  if (options.localeMode === 'fixed') locale = options.locale ?? null;
  else if (localeMode === 'rotate' && availableLocales.length > 1) locale = availableLocales[cycle % availableLocales.length];
  else if (options.localeMode === 'primary') locale = anyPayload?.dto.primaryLocale ?? null;
  const cacheKey = locale ?? '';

  const menuSlug = slide.guestMenuId ? (slide.guestMenuSlug ?? null) : null;
  const missingMenu = Boolean(slide.guestMenuId && !menuSlug);
  const accessHeader = slide.guestMenuAccessTokens?.join(',') ?? '';

  const load = useCallback(
    async (key: string) => {
      const url = getPublicMenuUrl(workspaceId, menuSlug, { output: 'monitor', lang: key || undefined });
      const etag = entriesRef.current[key]?.etag;
      try {
        const headers: Record<string, string> = {};
        if (etag) headers['If-None-Match'] = etag;
        if (accessHeader) headers['X-Guest-Menu-Access'] = accessHeader;
        const response = await fetch(url, { headers, cache: accessHeader ? 'no-store' : 'default' });
        if (response.status === 304) return;
        const body = response.ok ? await response.json() : null;
        const payload: MenuPayload | null = body?.status === 'ok' && body.menu ? body.menu : null;
        setEntries((current) => ({ ...current, [key]: { etag: response.ok ? response.headers.get('ETag') : null, payload } }));
        setFailed(false);
      } catch (error) {
        // Network hiccup: keep showing the last known state.
        console.error('GuestMenuSlide', error);
        if (!entriesRef.current[key]) setFailed(true);
      }
    },
    [workspaceId, menuSlug, accessHeader],
  );

  useEffect(() => {
    if (missingMenu) return;
    void load(cacheKey);
    const interval = window.setInterval(() => void load(cacheKey), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [load, cacheKey, missingMenu]);

  const entry = entries[cacheKey];
  // While another language loads, keep showing the previous one.
  const payload = entry ? entry.payload : anyPayload;
  const available: boolean | null = missingMenu ? false : entry ? entry.payload != null : failed && !anyPayload ? false : anyPayload ? true : null;

  useEffect(() => {
    if (available !== null) onAvailabilityChange?.(slide.id, available);
  }, [available, slide.id, onAvailabilityChange]);

  const pageDurationSeconds = options.pageDurationSeconds ?? payload?.dto.monitor?.pageDurationSeconds ?? fallbackPageDurationSeconds;
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!active) return;
    const timeout = window.setTimeout(
      () => {
        if (payload && page + 1 < pageCount) {
          setPage(page + 1);
          return;
        }
        setPage(0);
        setCycle((current) => current + 1);
        onCompleteRef.current();
      },
      Math.max(1, payload ? pageDurationSeconds : fallbackPageDurationSeconds) * 1000,
    );
    return () => window.clearTimeout(timeout);
  }, [active, page, pageCount, payload, pageDurationSeconds, fallbackPageDurationSeconds]);

  const qrUrl = useMemo(() => {
    if (!payload || typeof window === 'undefined') return undefined;
    // "Active menu" slides link to the bar URL, which always shows the current menu.
    const path = slide.guestMenuId ? payload.dto.menu.publicPath : payload.dto.menu.publicPath.replace(/\/[^/]+$/, '');
    return `${window.location.origin}${path}`;
  }, [payload, slide.guestMenuId]);

  if (!payload) return null;

  return (
    <GuestMenuMonitorView
      dto={payload.dto}
      rendered={payload.rendered}
      format={format}
      pageIndex={page}
      onPageCount={setPageCount}
      columns={options.columns ?? undefined}
      showQrCode={options.showQrCode ?? undefined}
      qrUrl={qrUrl}
    />
  );
}
