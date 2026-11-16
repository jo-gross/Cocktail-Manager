import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FaChevronRight } from 'react-icons/fa';
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
    <details className="group border-t border-base-300 pt-2 text-xs" onToggle={(event) => (event.currentTarget.open ? load() : undefined)}>
      <summary className="flex min-h-8 cursor-pointer list-none items-center gap-1.5 rounded text-base-content/60 hover:text-base-content focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <FaChevronRight aria-hidden className="text-[0.6rem] transition-transform group-open:rotate-90 motion-reduce:transition-none" />
        {t('onboarding:content.attribution')}
      </summary>
      <div className="mt-1 flex max-h-48 flex-col gap-2 overflow-y-auto pb-1 text-base-content/70">
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
