import type { WorkspacePlanSchema } from '@lib/schemas/entitlements';
import type { z } from 'zod';

type WorkspacePlan = z.infer<typeof WorkspacePlanSchema>;

/** Plan name in the UI language (`de` for German, otherwise `en`). */
export function planDisplayName(plan: Pick<WorkspacePlan, 'planName'>, language: string | undefined): string {
  return language?.toLowerCase().startsWith('de') ? plan.planName.de : plan.planName.en;
}

/** Share of a limit in percent for the usage bar; `null` for unlimited. */
export function usagePercent(used: number, limit: number | null): number | null {
  if (limit === null) return null;
  if (limit === 0) return 100;
  return Math.min(100, Math.round((used / limit) * 100));
}
