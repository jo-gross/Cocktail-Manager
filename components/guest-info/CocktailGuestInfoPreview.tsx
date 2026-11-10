import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Alert, Badge, Loading } from '@components/ui';
import type { DerivedGuestInfo } from '@lib/guest-info/derive';
import type { CocktailGuestInfoResponse } from '@lib/schemas/guestInfo';
import { getCocktailGuestInfo } from '@lib/network/guestInfo';
import { AlcoholBadge, formatAlcohol } from './AlcoholBadge';

/** "ca. 14 % vol · enthält Ei, Sulfite · optional: Milch" */
export function formatGuestInfoSummary(info: DerivedGuestInfo, t: TFunction<['guestInfo']>, locale: string): string {
  const required = info.allergens.filter((a) => !a.optional).map((a) => t(`guestInfo:allergenShort.${a.code}`));
  const optional = info.allergens.filter((a) => a.optional).map((a) => t(`guestInfo:allergenShort.${a.code}`));
  const parts = [formatAlcohol(info.alcohol, t, locale)];
  parts.push(required.length > 0 ? t('guestInfo:form.contains', { list: required.join(', ') }) : t('guestInfo:form.noAllergens'));
  if (optional.length > 0) parts.push(`${t('guestInfo:optional')}: ${optional.join(', ')}`);
  return parts.join(' · ');
}

export interface CocktailGuestInfoPreviewProps {
  workspaceId: string | string[];
  cocktailId?: string;
  /** Changes to this value trigger a reload (e.g. after saving). */
  reloadKey?: unknown;
}

/** Guest-facing preview of the derived cocktail info, loaded from the guest-info endpoint (saved state). */
export function CocktailGuestInfoPreview({ workspaceId, cocktailId, reloadKey }: CocktailGuestInfoPreviewProps) {
  const { t, i18n } = useTranslation(['guestInfo']);
  const [result, setResult] = useState<{ cocktailId: string; info: CocktailGuestInfoResponse | undefined } | undefined>();

  useEffect(() => {
    if (!cocktailId) return;
    let cancelled = false;
    getCocktailGuestInfo(workspaceId, cocktailId)
      .then((info) => {
        if (!cancelled) setResult({ cocktailId, info });
      })
      .catch(() => {
        if (!cancelled) setResult({ cocktailId, info: undefined });
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, cocktailId, reloadKey]);

  if (!cocktailId) return <div className="text-sm italic opacity-70">{t('guestInfo:form.previewUnavailable')}</div>;
  if (result?.cocktailId !== cocktailId) return <Loading size="sm" />;
  const info = result.info;
  if (!info) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-base-300 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{t('guestInfo:form.preview')}</span>
        <AlcoholBadge alcohol={info.alcohol} showCategory />
        <Badge variant="ghost" size="sm">
          {t(`guestInfo:alcohol.status.${info.alcohol.status}`)}
        </Badge>
      </div>
      <div className="text-sm">{formatGuestInfoSummary(info, t, i18n.language)}</div>
      {info.additives.length > 0 && (
        <div className="text-sm opacity-80">
          {t('guestInfo:additivesTitle')}:{' '}
          {info.additives.map((a) => `${t(`guestInfo:additive.${a.code}`)}${a.optional ? ` (${t('guestInfo:optional')})` : ''}`).join(', ')}
        </div>
      )}
      {info.sources.missingAbv.length > 0 && info.alcohol.status !== 'manual' && (
        <Alert variant="warning" className="text-sm">
          {t('guestInfo:form.missingAbv', { list: info.sources.missingAbv.map((s) => s.name).join(', ') })}
        </Alert>
      )}
      {!info.complete && (
        <Alert variant="warning" className="text-sm">
          {t('guestInfo:form.incompleteSources', { list: info.sources.incomplete.map((s) => s.name).join(', ') })}
        </Alert>
      )}
      <div className="text-xs italic opacity-60">{t('guestInfo:form.previewSavedHint')}</div>
    </div>
  );
}
