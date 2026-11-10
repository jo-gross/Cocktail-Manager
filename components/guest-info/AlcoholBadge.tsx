import React from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Badge, type BadgeProps } from '@components/ui';
import type { DerivedGuestInfo } from '@lib/guest-info/derive';
import { toIntlLocale } from '@lib/i18n/format';

type Alcohol = DerivedGuestInfo['alcohol'];

export function formatAbv(value: number, locale: string): string {
  return new Intl.NumberFormat(toIntlLocale(locale), { maximumFractionDigits: 1 }).format(value);
}

/** "ca. 14 % vol" / "14 % vol" (manual) / "alkoholfrei" / "Alkoholgehalt unbekannt". */
export function formatAlcohol(alcohol: Alcohol, t: TFunction<['guestInfo']>, locale: string): string {
  if (alcohol.status === 'unknown' || alcohol.abv == null) return t('guestInfo:alcohol.unknown');
  if (alcohol.alcoholFree) return t('guestInfo:alcohol.category.alcoholFree');
  const percent = t('guestInfo:alcohol.percent', { value: formatAbv(alcohol.abv, locale) });
  return alcohol.status === 'calculated' ? t('guestInfo:alcohol.approx', { value: percent }) : percent;
}

const categoryVariant: Record<NonNullable<Alcohol['category']>, BadgeProps['variant']> = {
  alcoholFree: 'success',
  light: 'info',
  medium: 'warning',
  strong: 'error',
};

export interface AlcoholBadgeProps {
  alcohol: Alcohol;
  /** Append the category ("leicht", "stark", …). */
  showCategory?: boolean;
  size?: BadgeProps['size'];
  className?: string;
}

/** Compact alcohol-content badge colored by category. */
export function AlcoholBadge({ alcohol, showCategory = false, size = 'sm', className }: AlcoholBadgeProps) {
  const { t, i18n } = useTranslation(['guestInfo']);
  const text = formatAlcohol(alcohol, t, i18n.language);
  const category = alcohol.status !== 'unknown' ? alcohol.category : null;
  return (
    <Badge
      variant={category ? categoryVariant[category] : 'ghost'}
      outline
      size={size}
      className={className}
      title={category ? t(`guestInfo:alcohol.categoryHint.${category}`) : undefined}
    >
      {text}
      {showCategory && category && category !== 'alcoholFree' && <span className="opacity-70">· {t(`guestInfo:alcohol.category.${category}`)}</span>}
    </Badge>
  );
}
