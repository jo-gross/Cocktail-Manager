import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { UserContext } from '@lib/context/UserContextProvider';
import { getWorkspaceContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import { getContentTranslations, updateContentTranslations } from '@lib/network/contentTranslations';
import { alertApiV1Error } from '@lib/network/apiV1';
import { CONTENT_TRANSLATION_FIELDS, type ContentTranslationEntityType } from '@lib/translations/contentTranslationFields';
import { i18n } from '@lib/i18n/client';
import type { ContentTranslationsUpdateInput } from '@lib/schemas/contentTranslations';

const cellKey = (field: string, locale: string) => `${field}:${locale}`;

export interface EntityContentTranslations {
  /** True when the workspace has additional content locales – otherwise no translation UI is shown. */
  enabled: boolean;
  primaryLocale: string;
  locales: string[];
  loading: boolean;
  dirty: boolean;
  getValue: (field: string, locale: string) => string;
  setValue: (field: string, locale: string, value: string) => void;
  /** Persists changed translations for the (possibly just created) entity. Resolves to false on error (already alerted). */
  save: (entityId: string) => Promise<boolean>;
}

/**
 * Loads and edits the content translations of one entity (cocktail, ingredient,
 * garnish, glass) for the form language tabs. Saving goes through the
 * content-translations API after the entity itself was saved.
 */
export function useEntityContentTranslations(entityType: ContentTranslationEntityType, entityId: string | undefined): EntityContentTranslations {
  const router = useRouter();
  const workspaceId = router.query.workspaceId as string | undefined;
  const userContext = useContext(UserContext);
  const settings = userContext.workspace?.settings;
  const contentLocales = useMemo(() => getWorkspaceContentLocales(settings ?? {}), [settings]);
  const enabled = contentLocales.additional.length > 0;

  const [initial, setInitial] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  // Key of the entity whose translations are loaded; loading = requested key not yet loaded.
  const requestKey = enabled && workspaceId && entityId ? `${workspaceId}:${entityType}:${entityId}` : undefined;
  const [loadedKey, setLoadedKey] = useState<string | undefined>(undefined);
  const loading = requestKey !== undefined && loadedKey !== requestKey;

  useEffect(() => {
    if (!requestKey || !workspaceId || !entityId) return;
    let cancelled = false;
    getContentTranslations(workspaceId, { entity: entityType, entityId })
      .then((result) => {
        if (cancelled) return;
        const loaded: Record<string, string> = {};
        for (const row of result.rows) {
          if (row.value) loaded[cellKey(row.field, row.locale)] = row.value;
        }
        setInitial(loaded);
        setValues(loaded);
      })
      .catch((error) => {
        if (!cancelled) alertApiV1Error(error, i18n.t('translations:errors.load'));
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(requestKey);
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, workspaceId, entityType, entityId]);

  const getValue = useCallback((field: string, locale: string) => values[cellKey(field, locale)] ?? '', [values]);
  const setValue = useCallback((field: string, locale: string, value: string) => {
    setValues((previous) => ({ ...previous, [cellKey(field, locale)]: value }));
  }, []);

  const changedItems = useMemo(() => {
    const items: { field: string; locale: string; value: string | null }[] = [];
    for (const field of CONTENT_TRANSLATION_FIELDS[entityType]) {
      for (const locale of contentLocales.additional) {
        const key = cellKey(field, locale);
        const current = (values[key] ?? '').trim();
        if (current !== (initial[key] ?? '').trim()) items.push({ field, locale, value: current === '' ? null : current });
      }
    }
    return items;
  }, [entityType, contentLocales.additional, values, initial]);

  const save = useCallback(
    async (savedEntityId: string) => {
      if (!enabled || !workspaceId || changedItems.length === 0) return true;
      try {
        await updateContentTranslations(workspaceId, {
          items: changedItems.map((item) => ({ entityType, entityId: savedEntityId, ...item })) as ContentTranslationsUpdateInput['items'],
        });
        setInitial(values);
        return true;
      } catch (error) {
        alertApiV1Error(error, i18n.t('translations:errors.save'));
        return false;
      }
    },
    [enabled, workspaceId, changedItems, entityType, values],
  );

  return {
    enabled,
    primaryLocale: contentLocales.primary,
    locales: contentLocales.additional,
    loading,
    dirty: changedItems.length > 0,
    getValue,
    setValue,
    save,
  };
}
