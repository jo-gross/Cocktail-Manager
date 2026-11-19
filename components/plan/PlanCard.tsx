import React from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, cn } from '@components/ui';
import { SettingsSection } from '@components/settings/SettingsSection';
import { LIMIT_KEYS } from '@lib/entitlements/snapshot';
import type { WorkspaceEntitlementDto } from '@lib/schemas/entitlements';
import { ManageSubscriptionButton } from './ManageSubscriptionButton';
import { planDisplayName, usagePercent } from './planLabels';

const STATUS_BADGE = { ACTIVE: 'success', GRACE: 'warning', READ_ONLY: 'error', SUSPENDED: 'error' } as const;

/**
 * Plan card of the workspace settings (only with `ENTITLEMENTS_MODE=managed`): plan name, status, usage against the
 * limits, features and "Abo verwalten" (`billing: portal`) or a contact hint (`billing: contact`).
 */
export function PlanCard({ entitlement, workspaceId }: { entitlement: WorkspaceEntitlementDto | null; workspaceId: string }) {
  const { t, i18n } = useTranslation(['plan']);
  if (!entitlement || entitlement.mode !== 'managed') return null;
  const { plan, usage } = entitlement;

  if (!plan) {
    return (
      <SettingsSection title={t('plan:card.title')} description={t('plan:card.description')}>
        <p className="text-sm">{t('plan:card.noPlan')}</p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      title={planDisplayName(plan, i18n.language)}
      description={t('plan:card.description')}
      badge={
        <Badge variant={STATUS_BADGE[plan.status]} size="sm">
          {t(`plan:status.${plan.status}`)}
        </Badge>
      }
      actions={plan.billing === 'portal' ? <ManageSubscriptionButton workspaceId={workspaceId} /> : null}
    >
      <div className="flex flex-col gap-4" data-testid="plan-card">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t('plan:card.usage')}</h3>
          <ul className="flex flex-col gap-2">
            {LIMIT_KEYS.map((key) => {
              const limit = plan.limits[key];
              const used = usage?.[key] ?? 0;
              const percent = usagePercent(used, limit);
              return (
                <li key={key} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span>{t(`plan:limits.${key}`)}</span>
                    <span className={cn(limit !== null && used >= limit && 'font-semibold text-error')}>
                      {limit === null ? `${used} · ${t('plan:card.unlimited')}` : t('plan:card.usageOf', { used, limit })}
                    </span>
                  </div>
                  {percent !== null ? (
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-300" role="presentation">
                      <div className={cn('h-full rounded-full', percent >= 100 ? 'bg-error' : 'bg-primary')} style={{ width: `${percent}%` }} />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{t('plan:card.features')}</h3>
          {plan.features.length === 0 ? (
            <p className="text-sm text-base-content/70">{t('plan:card.noFeatures')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {plan.features.map((feature) => (
                <Badge key={feature} variant="ghost" size="sm">
                  {t(`plan:features.${feature}`, { defaultValue: feature })}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {plan.nextChangeAt ? (
          <p className="text-sm text-base-content/70">{t('plan:card.nextChange', { date: new Date(plan.nextChangeAt).toLocaleDateString(i18n.language) })}</p>
        ) : null}
        {plan.billing === 'contact' ? <p className="text-sm">{t('plan:billing.contact')}</p> : null}
      </div>
    </SettingsSection>
  );
}
