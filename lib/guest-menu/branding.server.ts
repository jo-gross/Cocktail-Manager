/**
 * "Powered by" branding of public guest menus, the guest menu PDF and table tents on hosted instances: shown unless the
 * plan includes `branding.remove` (docs/ENTITLEMENTS.md). Self-hosted instances (`ENTITLEMENTS_MODE=off`) never show it.
 */
import { escapeHtml } from '@lib/guest-menu/render/markdown';
import { translateGuestText, type GuestUiLocale } from '@lib/guest-menu/render/uiTexts';
import { workspaceHasFeature } from '@lib/entitlements/guards';

export async function showPoweredBy(workspaceId: string): Promise<boolean> {
  return !(await workspaceHasFeature(workspaceId, 'branding.remove'));
}

/** Print CSS of the branding line (print documents allow only inline styles). */
export const POWERED_BY_PRINT_CSS = '.gm-powered-by{margin:4mm 0 0;text-align:center;font-size:7.5pt;opacity:.6;font-family:sans-serif}';

export function poweredByHtml(uiLocale: GuestUiLocale): string {
  return `<p class="gm-powered-by">${escapeHtml(translateGuestText('branding.poweredBy', uiLocale))}</p>`;
}
