/**
 * The one start content decision of the setup wizard's content step: a collection (with its scope)
 * or nothing. The wizard applies the choice with its primary button, so a selected collection is
 * never dropped silently. Pure module.
 */
import { TEMPLATE_ITEM_KINDS, type TemplateSelectionIds } from './templateSelection';

export const APPLY_MODES = ['all', 'basics', 'selection'] as const;
export type ApplyMode = (typeof APPLY_MODES)[number];

export type StartContentChoice = { kind: 'empty' } | { kind: 'template'; key: string; mode: ApplyMode; selection: TemplateSelectionIds };

/** What the primary button does: apply the chosen collection, start empty, or just continue (something was applied already). */
export type StartContentAction = { kind: 'apply'; key: string; mode: ApplyMode; count: number } | { kind: 'empty' } | { kind: 'next' };

export function selectionCount(selection: TemplateSelectionIds): number {
  return TEMPLATE_ITEM_KINDS.reduce((sum, kind) => sum + selection[kind].length, 0);
}

/**
 * The choice in effect: an explicit one, else the first offered collection for a first start and
 * "nothing more" once something was applied (or when there is nothing to offer).
 */
export function effectiveStartContentChoice(
  choice: StartContentChoice | null,
  offeredKeys: readonly string[],
  appliedCount: number,
  emptySelection: () => TemplateSelectionIds,
): StartContentChoice {
  if (choice && (choice.kind === 'empty' || offeredKeys.includes(choice.key))) return choice;
  if (appliedCount === 0 && offeredKeys[0]) return { kind: 'template', key: offeredKeys[0], mode: 'all', selection: emptySelection() };
  return { kind: 'empty' };
}

export function startContentAction(choice: StartContentChoice, appliedCount: number): StartContentAction {
  if (choice.kind === 'template') return { kind: 'apply', key: choice.key, mode: choice.mode, count: selectionCount(choice.selection) };
  return appliedCount > 0 ? { kind: 'next' } : { kind: 'empty' };
}
