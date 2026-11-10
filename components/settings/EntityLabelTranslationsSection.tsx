import React, { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSave } from 'react-icons/fa';
import {
  Badge,
  Button,
  Input,
  Loading,
  SkeletonTableRows,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Tabs,
  Toggle,
} from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { fetchActions } from '@lib/network/actions';
import { fetchUnits } from '@lib/network/units';
import { fetchIce } from '@lib/network/ices';
import { upsertTranslation } from '@lib/network/workspaces';
import type { ActionDto } from '@lib/schemas/actions';
import type { UnitDto } from '@lib/schemas/units';
import type { IceDto } from '@lib/schemas/ices';
import { SettingsSection } from './SettingsSection';
import { displayName } from './localeOptions';
import { labelLocales, useContentLocales } from './useContentLocales';

export const ENTITY_LABEL_KINDS = ['action', 'actionGroup', 'unit', 'ice'] as const;
export type EntityLabelKind = (typeof ENTITY_LABEL_KINDS)[number];

/** Translation keys (unique, sorted) of all workspace master data that is displayed via label translations. */
export function buildEntityLabelKeys(actions: Pick<ActionDto, 'name' | 'actionGroup'>[], units: Pick<UnitDto, 'name'>[], ice: Pick<IceDto, 'name'>[]) {
  const unique = (values: string[]) => [...new Set(values.filter((value) => value.trim() !== ''))].sort((a, b) => a.localeCompare(b));
  return {
    action: unique(actions.map((action) => action.name)),
    actionGroup: unique(actions.map((action) => action.actionGroup)),
    unit: unique(units.map((unit) => unit.name)),
    ice: unique(ice.map((entry) => entry.name)),
  } satisfies Record<EntityLabelKind, string[]>;
}

type Labels = Record<string, string>;

interface EntityLabelTranslationsSectionProps {
  workspaceId: string;
  onDirtyChange?: (dirty: boolean) => void;
}

/** Inline editor for the UI-language labels of preparation actions, action groups, units and ice. */
export function EntityLabelTranslationsSection({ workspaceId, onDirtyChange }: EntityLabelTranslationsSectionProps) {
  const { t, i18n } = useTranslation(['settings', 'common', 'errors']);
  const userContext = useContext(UserContext);
  const contentLocales = useContentLocales(workspaceId);
  // Columns follow the workspace's content languages (primary language first, required).
  const locales = useMemo(() => (contentLocales ? labelLocales(contentLocales) : []), [contentLocales]);
  const primaryLocale = locales[0];
  const languageName = (locale: string) => displayName(locale, 'language', i18n.language);

  const [actions, setActions] = useState<ActionDto[]>([]);
  const [units, setUnits] = useState<UnitDto[]>([]);
  const [ice, setIce] = useState<IceDto[]>([]);
  const [loading, setLoading] = useState({ actions: true, units: true, ice: true });
  const [kind, setKind] = useState<EntityLabelKind>('action');
  const [missingOnly, setMissingOnly] = useState(false);
  const [edits, setEdits] = useState<Record<string, Labels>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchActions(workspaceId, setActions, (value) => setLoading((previous) => ({ ...previous, actions: value })));
    fetchUnits(workspaceId, setUnits, (value) => setLoading((previous) => ({ ...previous, units: value })));
    fetchIce(workspaceId, setIce, (value) => setLoading((previous) => ({ ...previous, ice: value })));
  }, [workspaceId]);

  const keysByKind = useMemo(() => buildEntityLabelKeys(actions, units, ice), [actions, units, ice]);
  const isLoading = loading.actions || loading.units || loading.ice || contentLocales == null;

  const stored = (key: string, locale: string) => userContext.translations?.[locale]?.[key] ?? '';
  const valueOf = (key: string, locale: string) => edits[key]?.[locale] ?? stored(key, locale);
  const isMissing = (key: string) => locales.some((locale) => stored(key, locale).trim() === '');

  const changedKeys = Object.keys(edits).filter((key) => locales.some((locale) => valueOf(key, locale).trim() !== stored(key, locale).trim()));
  const invalidKeys = primaryLocale ? changedKeys.filter((key) => valueOf(key, primaryLocale).trim() === '') : [];
  const dirty = changedKeys.length > 0;

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const visibleKeys = keysByKind[kind].filter((key) => !missingOnly || isMissing(key) || edits[key] !== undefined);

  const save = async () => {
    if (!dirty || invalidKeys.length > 0) return;
    setSaving(true);
    try {
      for (const key of changedKeys) {
        // Only the active languages are sent; labels of removed languages stay stored and return when the language is re-added.
        const labels = Object.fromEntries(locales.map((locale) => [locale, valueOf(key, locale).trim()]));
        await upsertTranslation(workspaceId, { key, translations: labels });
        userContext.patchTranslations(key, labels);
      }
      setEdits({});
      void userContext.refreshWorkspace();
      alertService.success(t('settings:languages.labelsSaved', { count: changedKeys.length }));
    } catch (error) {
      alertApiV1Error(error, t('errors:save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsSection
      title={t('settings:languages.labelsTitle')}
      description={t('settings:languages.labelsHelp')}
      footer={
        <Button type="button" variant="primary" onClick={save} disabled={saving || !dirty || invalidKeys.length > 0}>
          {saving ? <Loading size="sm" /> : <FaSave aria-hidden />}
          {t('settings:languages.saveLabels', { count: changedKeys.length })}
        </Button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto">
          <Tabs aria-label={t('settings:languages.labelsTitle')}>
            {ENTITY_LABEL_KINDS.map((entry) => (
              <Tab key={entry} id={`entity-labels-tab-${entry}`} aria-controls="entity-labels-panel" active={kind === entry} onClick={() => setKind(entry)}>
                {t(`settings:languages.kinds.${entry}`)}
                <Badge size="sm" variant="ghost" className="ml-1.5">
                  {isLoading ? '…' : keysByKind[entry].length}
                </Badge>
              </Tab>
            ))}
          </Tabs>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <Toggle toggleSize="sm" checked={missingOnly} onChange={(event) => setMissingOnly(event.target.checked)} />
          {t('settings:languages.missingOnly')}
        </label>
      </div>

      <div
        id="entity-labels-panel"
        role="tabpanel"
        aria-labelledby={`entity-labels-tab-${kind}`}
        className="overflow-x-auto rounded-xl border border-base-300/60"
      >
        <Table zebra className="w-full">
          <TableHead>
            <TableRow>
              <TableHeaderCell className="w-1/4">{t('settings:key')}</TableHeaderCell>
              {locales.map((locale) => (
                <TableHeaderCell key={locale}>
                  {languageName(locale)}
                  {locale === primaryLocale ? <span className="text-error"> *</span> : null}
                </TableHeaderCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <SkeletonTableRows columns={1 + Math.max(locales.length, 1)} rows={4} avatarColumn={-1} />
            ) : visibleKeys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={1 + locales.length} className="text-center text-base-content/70">
                  {missingOnly ? t('settings:languages.noMissingLabels') : t('common:emptyEntriesPresent')}
                </TableCell>
              </TableRow>
            ) : (
              visibleKeys.map((key) => (
                <TableRow key={`${kind}-${key}`}>
                  <TableCell className="font-mono text-xs break-all">{key}</TableCell>
                  {locales.map((locale) => {
                    const value = valueOf(key, locale);
                    const changed = value.trim() !== stored(key, locale).trim();
                    const invalid = locale === primaryLocale && changed && value.trim() === '';
                    return (
                      <TableCell key={locale}>
                        <Input
                          inputSize="sm"
                          lang={locale}
                          value={value}
                          error={invalid}
                          aria-invalid={invalid || undefined}
                          aria-label={`${key} – ${languageName(locale)}`}
                          placeholder={locale === primaryLocale ? undefined : t('settings:languages.missingLabelHint')}
                          className={changed && !invalid ? 'border-warning' : undefined}
                          onChange={(event) => setEdits((previous) => ({ ...previous, [key]: { ...(previous[key] ?? {}), [locale]: event.target.value } }))}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {invalidKeys.length > 0 ? <p className="text-sm text-error">{t('settings:validation.invalidLabel')}</p> : null}
    </SettingsSection>
  );
}
