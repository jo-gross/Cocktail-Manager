import React, { useContext, useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaSearch } from 'react-icons/fa';
import { Button, Checkbox, Input, Skeleton, Tab, Tabs } from '@components/ui';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { alertApiV1Error } from '@lib/network/apiV1';
import { fetchTemplateItems, type TemplateItemsDto } from '@lib/network/templates';
import {
  matchesSearch,
  resolveTemplateSelection,
  setTemplatePicks,
  TEMPLATE_ITEM_KINDS,
  toggleTemplatePick,
  totalSelected,
  type TemplateItemKind,
  type TemplateSelectionIds,
} from '@lib/onboarding/templateSelection';
import { itemImageCredit } from './attribution';

interface TemplatePickerDialogProps {
  templateKey: string;
  templateName: string;
  locale: string;
  initial: TemplateSelectionIds;
  onConfirm: (selection: TemplateSelectionIds) => void;
}

/** Selection of single template items; dependencies (glass, ingredients, garnishes, cocktails of cards) are added automatically. */
export function TemplatePickerDialog({ templateKey, templateName, locale, initial, onConfirm }: TemplatePickerDialogProps) {
  const { t } = useTranslation(['onboarding', 'common']);
  const modalContext = useContext(ModalContext);
  const searchId = useId();
  const [items, setItems] = useState<TemplateItemsDto | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<TemplateItemKind>('cocktails');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<TemplateSelectionIds>(initial);

  useEffect(() => {
    let cancelled = false;
    fetchTemplateItems(templateKey, locale)
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .catch((error) => {
        alertApiV1Error(error, t('onboarding:content.picker.loadError'));
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [templateKey, locale, t]);

  const resolved = useMemo(() => (items ? resolveTemplateSelection(items, picked) : null), [items, picked]);
  const visible = useMemo(
    () => (items ? (items[tab] as Array<{ id: string; name: string }>).filter((item) => matchesSearch(item.name, search)) : []),
    [items, tab, search],
  );
  const explicit = useMemo(() => new Set(picked[tab]), [picked, tab]);
  const allVisiblePicked = visible.length > 0 && visible.every((item) => explicit.has(item.id));

  return (
    <div className="flex w-[min(48rem,calc(100vw-4rem))] flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold">{t('onboarding:content.picker.title', { template: templateName })}</h2>
        <p className="text-sm text-base-content/70">{t('onboarding:content.picker.help')}</p>
      </div>

      <Tabs variant="bordered" className="w-full overflow-x-auto" aria-label={t('onboarding:content.picker.tabsLabel')}>
        {TEMPLATE_ITEM_KINDS.map((kind) => (
          <Tab key={kind} active={tab === kind} onClick={() => setTab(kind)}>
            {t(`onboarding:kinds.${kind}`)}
            {resolved && items ? (
              <span className="ml-1 text-xs text-base-content/60">
                {resolved.counts[kind]}/{items[kind].length}
              </span>
            ) : null}
          </Tab>
        ))}
      </Tabs>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor={searchId} className="sr-only">
          {t('onboarding:content.picker.search')}
        </label>
        <div className="relative flex-1">
          <FaSearch aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-base-content/40" />
          <Input
            id={searchId}
            className="w-full pl-9"
            value={search}
            placeholder={t('onboarding:content.picker.search')}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={visible.length === 0}
          onClick={() =>
            setPicked((previous) =>
              setTemplatePicks(
                previous,
                tab,
                visible.map((item) => item.id),
                !allVisiblePicked,
              ),
            )
          }
        >
          {allVisiblePicked ? t('onboarding:content.picker.selectNone') : t('onboarding:content.picker.selectAll')}
        </Button>
      </div>

      <div className="max-h-[50vh] min-h-48 overflow-y-auto rounded-lg border border-base-300">
        {failed ? (
          <p className="p-4 text-sm text-base-content/70">{t('onboarding:content.picker.loadError')}</p>
        ) : !items || !resolved ? (
          <div className="flex flex-col gap-2 p-3" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : visible.length === 0 ? (
          <p className="p-4 text-sm text-base-content/70">{t('onboarding:content.picker.empty')}</p>
        ) : (
          <ul className="divide-y divide-base-300">
            {visible.map((item) => {
              const requiredBy = resolved.requiredBy[tab].get(item.id);
              const checked = resolved.selected[tab].has(item.id);
              const locked = requiredBy !== undefined && !explicit.has(item.id);
              const credit = itemImageCredit(item);
              const inputId = `${searchId}-${tab}-${item.id}`;
              return (
                <li key={item.id} className="flex items-start gap-3 px-3 py-2">
                  <Checkbox
                    id={inputId}
                    className="mt-0.5"
                    checked={checked}
                    disabled={locked}
                    onChange={(event) => setPicked((previous) => toggleTemplatePick(previous, tab, item.id, event.target.checked))}
                  />
                  <label htmlFor={inputId} className="flex min-w-0 flex-1 cursor-pointer flex-col">
                    <span className="font-medium">{item.name}</span>
                    {requiredBy ? (
                      <span className="text-xs text-base-content/60">
                        {requiredBy.length > 3
                          ? t('onboarding:content.picker.requiredByMore', { names: requiredBy.slice(0, 3).join(', '), count: requiredBy.length - 3 })
                          : t('onboarding:content.picker.requiredBy', { names: requiredBy.join(', ') })}
                      </span>
                    ) : null}
                    {credit ? <span className="text-xs text-base-content/50">{t('onboarding:content.imageCredit', { credit })}</span> : null}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-sm text-base-content/70" aria-live="polite">
          {resolved ? t('onboarding:content.picker.selected', { count: totalSelected(resolved.counts) }) : null}
        </span>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => modalContext.closeModal()}>
            {t('common:cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            disabled={!resolved || totalSelected(resolved.counts) === 0}
            onClick={() => {
              onConfirm(picked);
              modalContext.closeModal();
            }}
          >
            {t('onboarding:content.picker.confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
}
