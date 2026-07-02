import type { CardEditorGroup, CardEditorGroupItem } from './types';

function withUpdatedNumbers<T extends { groupNumber?: number; itemNumber?: number }>(items: T[], numberKey: 'groupNumber' | 'itemNumber'): T[] {
  return items.map((item, index) => ({
    ...item,
    [numberKey]: index,
  }));
}

export function reorderGroups(groups: CardEditorGroup[], fromIndex: number, toIndex: number): CardEditorGroup[] {
  const next = [...groups];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return withUpdatedNumbers(next, 'groupNumber');
}

export function reorderGroupItems(items: CardEditorGroupItem[], fromIndex: number, toIndex: number): CardEditorGroupItem[] {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return withUpdatedNumbers(next, 'itemNumber');
}

export function parseGroupDragId(id: string): number | null {
  if (!id.startsWith('group:')) return null;
  const index = Number(id.replace('group:', ''));
  return Number.isNaN(index) ? null : index;
}

export function parseItemDragId(id: string): { groupIndex: number; itemIndex: number } | null {
  if (!id.startsWith('item:')) return null;
  const [, groupIndexRaw, itemIndexRaw] = id.split(':');
  const groupIndex = Number(groupIndexRaw);
  const itemIndex = Number(itemIndexRaw);
  if (Number.isNaN(groupIndex) || Number.isNaN(itemIndex)) return null;
  return { groupIndex, itemIndex };
}

export function groupDragId(groupIndex: number): string {
  return `group:${groupIndex}`;
}

export function itemDragId(groupIndex: number, itemIndex: number): string {
  return `item:${groupIndex}:${itemIndex}`;
}
