import { useEffect, useState } from 'react';
import { getWorkspaceSettings } from '@lib/network/workspaces';
import { DEFAULT_CONTENT_LOCALES, getWorkspaceContentLocales, type ContentLocales } from '@lib/workspace/workspaceLocaleSettings';

/** Fired by the content language settings after saving, so other sections on the page update their columns. */
export const CONTENT_LOCALES_CHANGED_EVENT = 'workspace-content-locales-changed';

export function notifyContentLocalesChanged(contentLocales: ContentLocales) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ContentLocales>(CONTENT_LOCALES_CHANGED_EVENT, { detail: contentLocales }));
}

/** Label languages = primary content language first, then the additional ones (without duplicates). */
export function labelLocales(contentLocales: ContentLocales): string[] {
  return [...new Set([contentLocales.primary, ...contentLocales.additional])];
}

/** The workspace's content languages; `null` while loading. Follows changes saved on the same page. */
export function useContentLocales(workspaceId: string | undefined): ContentLocales | null {
  const [contentLocales, setContentLocales] = useState<ContentLocales | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    getWorkspaceSettings(workspaceId)
      .then((settings) => {
        if (!cancelled) setContentLocales(getWorkspaceContentLocales(settings));
      })
      .catch(() => {
        if (!cancelled) setContentLocales(DEFAULT_CONTENT_LOCALES);
      });
    const onChange = (event: Event) => setContentLocales((event as CustomEvent<ContentLocales>).detail);
    window.addEventListener(CONTENT_LOCALES_CHANGED_EVENT, onChange);
    return () => {
      cancelled = true;
      window.removeEventListener(CONTENT_LOCALES_CHANGED_EVENT, onChange);
    };
  }, [workspaceId]);

  return contentLocales;
}
