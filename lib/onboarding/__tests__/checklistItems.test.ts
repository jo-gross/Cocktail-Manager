import { describe, expect, it } from 'vitest';
import { ONBOARDING_CHECKLIST_ITEMS, parseChecklistSkipped, serializeChecklistSkipped, validateChecklistSkippedValue } from '../checklistItems';
import { ONBOARDING_CHECKLIST_ITEMS as SCHEMA_ITEMS } from '@lib/schemas/onboarding';
import { validateWorkspaceSettingValue } from '@lib/workspace/workspaceLocaleSettings';
import { WorkspaceSettingUpdateSchema } from '@lib/schemas/workspace';

describe('onboardingChecklistSkipped setting', () => {
  it('uses the same ids as the API schema', () => {
    expect(SCHEMA_ITEMS).toBe(ONBOARDING_CHECKLIST_ITEMS);
  });

  it('accepts a JSON array of unique known ids', () => {
    expect(validateChecklistSkippedValue('[]')).toBeNull();
    expect(validateChecklistSkippedValue('["guestMenu","team"]')).toBeNull();
    expect(validateWorkspaceSettingValue('onboardingChecklistSkipped', '["cards"]')).toBeNull();
    expect(validateWorkspaceSettingValue('onboardingChecklistSkipped', null)).toBeNull();
  });

  it('rejects unknown ids, duplicates and non-arrays', () => {
    expect(validateChecklistSkippedValue('["nope"]')).toMatch(/onboardingChecklistSkipped/);
    expect(validateChecklistSkippedValue('["team","team"]')).not.toBeNull();
    expect(validateChecklistSkippedValue('{"team":true}')).not.toBeNull();
    expect(validateChecklistSkippedValue('not json')).not.toBeNull();
    expect(WorkspaceSettingUpdateSchema.safeParse({ setting: 'onboardingChecklistSkipped', value: '[1]' }).success).toBe(false);
    expect(WorkspaceSettingUpdateSchema.safeParse({ setting: 'onboardingChecklistSkipped', value: '["team"]' }).success).toBe(true);
  });

  it('reads leniently and writes in checklist order', () => {
    expect(parseChecklistSkipped(null)).toEqual([]);
    expect(parseChecklistSkipped('broken')).toEqual([]);
    expect(parseChecklistSkipped('{"a":1}')).toEqual([]);
    expect(parseChecklistSkipped('["guestMenu","unknown","glasses"]')).toEqual(['glasses', 'guestMenu']);
    expect(serializeChecklistSkipped(['guestMenu', 'glasses', 'glasses'])).toBe('["glasses","guestMenu"]');
    expect(serializeChecklistSkipped([])).toBeNull();
  });
});
