import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useReportUnsavedChanges } from '@lib/forms/useUnsavedChanges';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { Role } from '@generated/prisma/client';
import { FaFileDownload, FaFileUpload, FaSave } from 'react-icons/fa';
import ListSearchField from '@components/ListSearchField';
import { UserContext } from '@lib/context/UserContextProvider';
import { alertService } from '@lib/alertService';
import { alertApiV1Error } from '@lib/network/apiV1';
import { getContentTranslations, updateContentTranslations } from '@lib/network/contentTranslations';
import { getWorkspaceContentLocales } from '@lib/workspace/workspaceLocaleSettings';
import {
  CONTENT_TRANSLATION_ENTITY_TYPES,
  contentTranslationKey,
  isMultilineContentField,
  type ContentTranslationEntityType,
} from '@lib/translations/contentTranslationFields';
import { ContentTranslationCsvError, parseContentTranslationCsv, serializeContentTranslationCsv } from '@lib/translations/contentTranslationCsv';
import type { ContentTranslationRow, ContentTranslationsUpdateInput } from '@lib/schemas/contentTranslations';
import {
  Alert,
  Badge,
  Button,
  DataTable,
  Input,
  Label,
  LabelText,
  Loading,
  Select,
  SkeletonTableRows,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  Textarea,
  Toggle,
} from '@components/ui';
import { SettingsSection } from './SettingsSection';
import { displayName } from './localeOptions';
import { settingsHref } from './settingsNavigation';

const PAGE_SIZE = 200;

const rowKey = (row: Pick<ContentTranslationRow, 'entityType' | 'entityId' | 'field' | 'locale'>) =>
  contentTranslationKey(row.entityType, row.entityId, row.field, row.locale);

const isBlank = (value: string | null | undefined) => value == null || value.trim() === '';

function downloadText(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

interface ContentTranslationCenterProps {
  workspaceId: string;
  /** Receives the reload function (e.g. for pull-to-refresh). */
  refreshRef?: React.MutableRefObject<(() => void) | undefined>;
}

/** Translation center: translate cocktails, ingredients, garnishes and glasses into the additional content languages. */
export function ContentTranslationCenter({ workspaceId, refreshRef }: ContentTranslationCenterProps) {
  const { t } = useTranslation(['translations', 'common', 'manage']);
  const userContext = useContext(UserContext);
  const canEdit = userContext.isUserPermitted(Role.MANAGER);

  const settings = userContext.workspace?.settings;
  const contentLocales = useMemo(() => getWorkspaceContentLocales(settings ?? {}), [settings]);

  const [rows, setRows] = useState<ContentTranslationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [locale, setLocale] = useState<string | undefined>(undefined);
  const [entityFilter, setEntityFilter] = useState<ContentTranslationEntityType | ''>('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeLocale = locale && contentLocales.additional.includes(locale) ? locale : contentLocales.additional[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getContentTranslations(workspaceId);
      setRows(result.rows);
    } catch (error) {
      alertApiV1Error(error, t('translations:errors.load'));
    } finally {
      setLoading(false);
    }
  }, [workspaceId, t]);

  useEffect(() => {
    void load();
  }, [load, contentLocales.additional.length]);

  useEffect(() => {
    if (!refreshRef) return;
    refreshRef.current = () => void load();
    return () => {
      refreshRef.current = undefined;
    };
  }, [refreshRef, load]);

  const currentValue = useCallback((row: ContentTranslationRow) => edits[rowKey(row)] ?? row.value ?? '', [edits]);

  const progress = useMemo(
    () =>
      contentLocales.additional.map((code) => {
        const relevant = rows.filter((row) => row.locale === code && !isBlank(row.source));
        const done = relevant.filter((row) => !isBlank(currentValue(row))).length;
        return { locale: code, done, total: relevant.length };
      }),
    [rows, contentLocales.additional, currentValue],
  );

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (row.locale !== activeLocale) return false;
      if (entityFilter && row.entityType !== entityFilter) return false;
      // Uses the stored value so rows don't disappear while typing.
      if (missingOnly && (isBlank(row.source) || !isBlank(row.value))) return false;
      if (term) {
        const haystack = [row.entityName, row.source ?? '', currentValue(row)].join(' ').toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [rows, activeLocale, entityFilter, missingOnly, search, currentValue]);

  const changedItems = useMemo(
    () =>
      rows
        .filter((row) => edits[rowKey(row)] !== undefined && edits[rowKey(row)].trim() !== (row.value ?? '').trim())
        .map((row) => {
          const value = edits[rowKey(row)].trim();
          return { entityType: row.entityType, entityId: row.entityId, field: row.field, locale: row.locale, value: value === '' ? null : value };
        }),
    [rows, edits],
  );

  useReportUnsavedChanges(changedItems.length > 0);

  const handleSave = useCallback(async () => {
    if (changedItems.length === 0) return;
    setSaving(true);
    try {
      const result = await updateContentTranslations(workspaceId, { items: changedItems as ContentTranslationsUpdateInput['items'] });
      alertService.success(t('translations:center.saved', { count: result.updated }));
      setEdits({});
      await load();
    } catch (error) {
      alertApiV1Error(error, t('translations:errors.save'));
    } finally {
      setSaving(false);
    }
  }, [workspaceId, changedItems, load, t]);

  const handleExport = useCallback(() => {
    if (!activeLocale) return;
    const csv = serializeContentTranslationCsv(
      filteredRows.map((row) => ({
        entityType: row.entityType,
        entityId: row.entityId,
        field: row.field,
        source: row.source ?? '',
        locale: row.locale,
        value: currentValue(row),
      })),
    );
    downloadText(csv, `translations-${activeLocale}-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8');
  }, [activeLocale, filteredRows, currentValue]);

  const handleImportFile = useCallback(
    async (file: File) => {
      setImporting(true);
      try {
        const parsed = parseContentTranslationCsv(await file.text());
        const items = parsed.items.filter((item) => item.locale !== contentLocales.primary);
        const ignored = parsed.invalidRows.length + (parsed.items.length - items.length);
        if (items.length === 0) {
          alertService.warn(t('translations:center.importNothing'));
          return;
        }
        const result = await updateContentTranslations(workspaceId, { items: items as ContentTranslationsUpdateInput['items'] });
        alertService.success(t('translations:center.imported', { count: result.updated }));
        if (ignored + result.skipped > 0) {
          alertService.warn(t('translations:center.importIgnored', { count: ignored + result.skipped }));
        }
        await load();
      } catch (error) {
        if (error instanceof ContentTranslationCsvError) {
          alertService.error(error.code === 'EMPTY' ? t('translations:errors.csvEmpty') : t('translations:errors.csvColumns'));
        } else {
          alertApiV1Error(error, t('translations:errors.import'));
        }
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [workspaceId, contentLocales.primary, load, t],
  );

  const uiLocale = userContext.uiLocale;

  if (contentLocales.additional.length === 0) {
    return (
      <Alert variant="info">
        <div className="flex flex-col gap-1">
          <span>{t('translations:center.noLocales')}</span>
          {userContext.isUserPermitted(Role.ADMIN) && (
            <Link className="link font-semibold" href={settingsHref(workspaceId, 'languages')}>
              {t('translations:center.openSettings')}
            </Link>
          )}
        </div>
      </Alert>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('translations:center.language')}>
        {progress.map((entry) => {
          const percent = entry.total === 0 ? 100 : Math.round((entry.done / entry.total) * 100);
          const active = entry.locale === activeLocale;
          return (
            <li key={entry.locale}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => setLocale(entry.locale)}
                className={`w-full rounded-box border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none ${active ? 'border-primary bg-primary/5' : 'border-base-300 bg-base-100 hover:bg-base-200'}`}
              >
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>
                    {displayName(entry.locale, 'language', uiLocale)} ({entry.locale})
                  </span>
                  <span>{percent} %</span>
                </div>
                <progress className="mt-2 h-2 w-full accent-primary" value={entry.done} max={Math.max(entry.total, 1)} />
                <div className="mt-1 text-xs text-base-content/60">{t('translations:center.progress', { done: entry.done, total: entry.total })}</div>
              </button>
            </li>
          );
        })}
      </ul>

      <SettingsSection
        title={t('translations:title')}
        description={t('translations:tileDescription')}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={handleExport}>
              <FaFileDownload aria-hidden />
              {t('translations:center.exportCsv')}
            </Button>
            {canEdit && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleImportFile(file);
                  }}
                />
                <Button type="button" variant="outline" size="sm" disabled={importing} onClick={() => fileInputRef.current?.click()}>
                  {importing ? <Loading size="sm" /> : <FaFileUpload aria-hidden />}
                  {t('translations:center.importCsv')}
                </Button>
                <Button type="button" variant="primary" size="sm" disabled={saving || changedItems.length === 0} onClick={handleSave}>
                  {saving ? <Loading size="sm" /> : <FaSave aria-hidden />}
                  {t('translations:center.save', { count: changedItems.length })}
                </Button>
              </>
            )}
          </>
        }
      >
        <DataTable
          toolbar={
            <div className="flex flex-wrap items-end gap-2">
              <Label className="flex-col items-start gap-1">
                <LabelText>{t('translations:center.language')}</LabelText>
                <Select selectSize="sm" value={activeLocale} onChange={(event) => setLocale(event.target.value)}>
                  {contentLocales.additional.map((code) => (
                    <option key={code} value={code}>
                      {displayName(code, 'language', uiLocale)} ({code})
                    </option>
                  ))}
                </Select>
              </Label>
              <Label className="flex-col items-start gap-1">
                <LabelText>{t('translations:center.entity')}</LabelText>
                <Select
                  selectSize="sm"
                  value={entityFilter}
                  onChange={(event) => {
                    setEntityFilter(event.target.value as ContentTranslationEntityType | '');
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  <option value="">{t('translations:center.allEntities')}</option>
                  {CONTENT_TRANSLATION_ENTITY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`translations:entityTypes.${type}`)}
                    </option>
                  ))}
                </Select>
              </Label>
              <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
                <Toggle toggleSize="sm" checked={missingOnly} onChange={(event) => setMissingOnly(event.target.checked)} />
                {t('translations:center.missingOnly')}
              </label>
              <div className="min-w-48 flex-1">
                <ListSearchField onFilterChange={(value) => setSearch(value)} />
              </div>
            </div>
          }
        >
          <Table zebra className="w-full">
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('translations:center.entry')}</TableHeaderCell>
                <TableHeaderCell>{t('translations:center.field')}</TableHeaderCell>
                <TableHeaderCell className="w-1/3">
                  {t('translations:center.source')} ({contentLocales.primary})
                </TableHeaderCell>
                <TableHeaderCell className="w-1/3">
                  {t('translations:center.translation')} ({activeLocale})
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <SkeletonTableRows columns={4} avatarColumn={-1} />
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    {t('manage:noEntriesFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.slice(0, visibleCount).map((row) => {
                  const key = rowKey(row);
                  const value = currentValue(row);
                  const changed = edits[key] !== undefined && edits[key].trim() !== (row.value ?? '').trim();
                  const onChange = (next: string) => setEdits((previous) => ({ ...previous, [key]: next }));
                  const label = `${row.entityName} – ${t(`translations:fields.${row.field}`)}`;
                  return (
                    <TableRow key={key}>
                      <TableCell className="align-top">
                        <div className="font-bold">{row.entityName}</div>
                        <Badge size="sm" variant="ghost">
                          {t(`translations:entityTypes.${row.entityType}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">{t(`translations:fields.${row.field}`)}</TableCell>
                      <TableCell className="align-top text-sm whitespace-pre-wrap">{row.source}</TableCell>
                      <TableCell className="align-top">
                        {isMultilineContentField(row.field) ? (
                          <Textarea
                            value={value}
                            rows={3}
                            lang={row.locale}
                            aria-label={label}
                            readOnly={!canEdit}
                            className={changed ? 'border-warning' : undefined}
                            onChange={(event) => onChange(event.target.value)}
                          />
                        ) : (
                          <Input
                            value={value}
                            lang={row.locale}
                            aria-label={label}
                            readOnly={!canEdit}
                            autoComplete="off"
                            className={changed ? 'border-warning' : undefined}
                            onChange={(event) => onChange(event.target.value)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {!loading && filteredRows.length > visibleCount && (
            <div className="flex justify-center p-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
                {t('translations:center.showMore', { count: filteredRows.length - visibleCount })}
              </Button>
            </div>
          )}
        </DataTable>
      </SettingsSection>
    </>
  );
}
