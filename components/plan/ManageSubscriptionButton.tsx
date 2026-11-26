import React, { useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Role } from '@generated/prisma/client';
import { Button, Loading, Tooltip } from '@components/ui';
import { UserContext } from '@lib/context/UserContextProvider';
import { normalizeLocale } from '@lib/i18n/locales';
import { openSubscriptionPortal, portalButtonState, PortalHandoffError, type PortalButtonState } from '@lib/entitlements/subscriptionPortal';
import type { HandoffIntent } from '@lib/portal/constants';

type Size = 'sm' | 'md';

/** Translation key of a failed handoff. */
function errorKey(code: string) {
  return code === 'EMAIL_NOT_VERIFIED' ? ('plan:billing.emailNotVerified' as const) : ('plan:billing.handoffFailed' as const);
}

/** Presentation of the portal button per state; separate from the click handling so every state can be rendered in tests. */
export function ManageSubscriptionButtonView({
  state,
  intent = 'manage',
  size = 'sm',
  busy = false,
  error = null,
  onClick,
}: {
  state: PortalButtonState;
  intent?: HandoffIntent;
  size?: Size;
  busy?: boolean;
  /** `error.code` of the last failed attempt. */
  error?: string | null;
  onClick?: () => void;
}) {
  const { t } = useTranslation(['plan']);

  if (state === 'notOwner') {
    return (
      <p className="text-sm text-base-content/70" data-testid="portal-owners-only">
        {t('plan:billing.ownersOnly')}
      </p>
    );
  }

  const button = (
    <Button type="button" variant="primary" size={size} disabled={state !== 'ready' || busy} aria-busy={busy || undefined} onClick={onClick}>
      {busy ? <Loading size="sm" /> : null}
      {t(intent === 'upgrade' ? 'plan:billing.upgrade' : 'plan:billing.manage')}
    </Button>
  );

  if (state === 'unavailable') return <Tooltip tip={t('plan:billing.manageUnavailable')}>{button}</Tooltip>;

  const hint = state === 'emailNotVerified' ? t('plan:billing.emailNotVerified') : error ? t(errorKey(error)) : null;
  return (
    <div className="flex flex-col items-end gap-1" data-testid="portal-button">
      {button}
      {hint ? (
        <p
          className={state === 'emailNotVerified' ? 'max-w-xs text-right text-sm text-base-content/70' : 'max-w-xs text-right text-sm text-error'}
          role={error ? 'alert' : undefined}
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * "Abo verwalten" (`intent: manage`) or "Upgrade" (`intent: upgrade`) for `billing: portal`. `available` is
 * `portalHandoff` of the workspace plan; owners with a verified email address get a fresh handoff per click and are
 * taken to the customer portal (docs/ENTITLEMENTS.md "Portal handoff").
 */
export function ManageSubscriptionButton({
  workspaceId,
  available,
  intent = 'manage',
  size = 'sm',
}: {
  workspaceId: string;
  available: boolean;
  intent?: HandoffIntent;
  size?: Size;
}) {
  const { i18n } = useTranslation(['plan']);
  const userContext = useContext(UserContext);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Back from the portal (page restored from the back/forward cache): the button is usable again.
  useEffect(() => {
    const reset = (event: PageTransitionEvent) => {
      if (event.persisted) setBusy(false);
    };
    window.addEventListener('pageshow', reset);
    return () => window.removeEventListener('pageshow', reset);
  }, []);

  const state = portalButtonState({
    available,
    isOwner: userContext.isUserPermitted(Role.OWNER),
    emailVerified: userContext.user?.emailVerified === true,
  });

  return (
    <ManageSubscriptionButtonView
      state={state}
      intent={intent}
      size={size}
      busy={busy}
      error={error}
      onClick={async () => {
        setBusy(true);
        setError(null);
        try {
          // Stays busy while the browser leaves for the portal.
          await openSubscriptionPortal(workspaceId, intent, normalizeLocale(i18n.language));
        } catch (cause) {
          setError(cause instanceof PortalHandoffError ? cause.code : 'ERROR');
          setBusy(false);
        }
      }}
    />
  );
}
