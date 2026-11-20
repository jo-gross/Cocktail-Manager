import React, { useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { UserContext } from '@lib/context/UserContextProvider';
import { fetchAnnouncements } from '@lib/network/announcements';
import { useEntitlementsMode } from '@lib/network/entitlementsMode';
import { dismiss, readDismissed, type DismissalStorage } from '@lib/announcements/dismissal';
import type { AnnouncementDto } from '@lib/schemas/announcements';
import { AnnouncementBannerList } from './AnnouncementBannerList';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Where announcements are shown: `null` (workspace id) on the workspace overview, the workspace id inside a
 * workspace, `undefined` on every other page.
 */
export function announcementScope(pathname: string, workspaceId: string | string[] | undefined): string | null | undefined {
  if (pathname === '/') return null;
  if (pathname.startsWith('/workspaces/[workspaceId]') && typeof workspaceId === 'string' && workspaceId !== '') return workspaceId;
  return undefined;
}

function browserStorage(): DismissalStorage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Banner with the active announcements of the hosting provider, on the workspace overview (announcements for all
 * workspaces) and inside a workspace (for all and for this workspace). Only with `ENTITLEMENTS_MODE=managed`:
 * self-hosted instances never have announcements, so they neither request nor poll them.
 */
export function AnnouncementBanner() {
  const router = useRouter();
  const { user, uiLocale } = useContext(UserContext);
  const scope = user ? announcementScope(router.pathname, router.query.workspaceId) : undefined;
  const mode = useEntitlementsMode(scope !== undefined);

  const [loaded, setLoaded] = useState<{ scope: string | null; announcements: AnnouncementDto[] } | undefined>();
  const [dismissed, setDismissed] = useState<string[]>([]);

  useEffect(() => {
    if (scope === undefined || mode !== 'managed') return;
    const controller = new AbortController();
    const load = () => {
      fetchAnnouncements(scope, controller.signal)
        .then((announcements) => {
          // Read with every load, so a dismissal in another tab is picked up too.
          setDismissed(readDismissed(browserStorage()));
          setLoaded({ scope, announcements });
        })
        // Not worth an alert: without an answer the last known announcements stay.
        .catch(() => undefined);
    };
    load();
    const interval = window.setInterval(load, REFRESH_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [scope, mode]);

  const onDismiss = useCallback((announcement: AnnouncementDto) => {
    setDismissed((current) => dismiss(browserStorage(), announcement, current));
  }, []);

  // Announcements of another scope (previous workspace) are not shown while the new ones load.
  if (scope === undefined || mode !== 'managed' || !loaded || loaded.scope !== scope) return null;
  return <AnnouncementBannerList announcements={loaded.announcements} dismissed={dismissed} locale={uiLocale} onDismiss={onDismiss} />;
}

export default AnnouncementBanner;
