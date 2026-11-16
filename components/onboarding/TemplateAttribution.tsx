import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from '@components/ui';
import { fetchTemplateItems } from '@lib/network/templates';
import { TEMPLATE_ITEM_KINDS } from '@lib/onboarding/templateSelection';
import { itemImageCredit } from './attribution';

interface Credit {
  name: string;
  credit: string;
}

/** "Sources & image credits" of a template; the per-item credits are loaded when opened. */
export function TemplateAttribution({ templateKey, locale, source }: { templateKey: string; locale: string; source: string | null }) {
  const { t } = useTranslation(['onboarding']);
  const [credits, setCredits] = useState<Credit[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    if (credits || loading) return;
    setLoading(true);
    fetchTemplateItems(templateKey, locale)
      .then((items) =>
        setCredits(
          TEMPLATE_ITEM_KINDS.flatMap((kind) =>
            (items[kind] as Array<{ name: string }>).flatMap((item) => {
              const credit = itemImageCredit(item);
              return credit ? [{ name: item.name, credit }] : [];
            }),
          ),
        ),
      )
      .catch((error) => {
        console.error('TemplateAttribution', error);
        setCredits([]);
      })
      .finally(() => setLoading(false));
  };

  return (
    <details className="text-sm" onToggle={(event) => (event.currentTarget.open ? load() : undefined)}>
      <summary className="cursor-pointer text-base-content/70 hover:text-base-content">{t('onboarding:content.attribution')}</summary>
      <div className="mt-2 flex flex-col gap-2 text-xs text-base-content/70">
        {source ? <p className="break-words whitespace-pre-line">{source}</p> : null}
        {loading ? <Skeleton className="h-8 w-full" /> : null}
        {credits && credits.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {credits.map((entry, index) => (
              <li key={index} className="break-words">
                {t('onboarding:content.itemCredit', { name: entry.name, credit: entry.credit })}
              </li>
            ))}
          </ul>
        ) : null}
        {!source && credits && credits.length === 0 ? <p>{t('onboarding:content.noAttribution')}</p> : null}
      </div>
    </details>
  );
}
