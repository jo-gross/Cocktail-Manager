import React from 'react';
import { useTranslation } from 'react-i18next';
import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, Modifier, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FaGripVertical } from 'react-icons/fa';
import { cn } from '@components/ui';

/** Look of a drag handle: one 44px touch target; `touch-none` so dragging doesn't scroll the page on tablets. */
export const dragHandleClassName = cn(
  'flex h-11 w-8 shrink-0 touch-none items-center justify-center rounded-lg text-base-content/40 transition-colors',
  'hover:bg-base-300/60 hover:text-base-content/70 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
);

const restrictToVerticalAxis: Modifier = ({ transform }) => ({ ...transform, x: 0 });

interface SortableListProps<T> {
  items: T[];
  /** Stable, unique id per item within this list. */
  getId: (item: T, index: number) => string;
  /** Called after a drop with the old and the new index. */
  onMove: (from: number, to: number) => void;
  /** `handle` is the drag handle – place it anywhere in the item. */
  renderItem: (item: T, index: number, handle: React.ReactNode) => React.ReactNode;
  className?: string;
}

/**
 * Vertical list reordered by a drag handle (touch, mouse and keyboard: focus the handle, Space, arrows, Space).
 * Replaces rows of tiny up/down buttons – one large target per row works far better on a tablet.
 */
export function SortableList<T>({ items, getId, onMove, renderItem, className }: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map((item, index) => getId(item, index));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from >= 0 && to >= 0) onMove(from, to);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[restrictToVerticalAxis]} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item, index) => (
            <SortableItem key={ids[index]} id={ids[index]} disabled={items.length < 2}>
              {(handle) => renderItem(item, index, handle)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ id, disabled, children }: { id: string; disabled: boolean; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { t } = useTranslation(['common']);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });

  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={t('common:dragToSort')}
      title={t('common:dragToSort')}
      disabled={disabled}
      className={cn(dragHandleClassName, disabled ? 'cursor-default opacity-30' : 'cursor-grab active:cursor-grabbing')}
    >
      <FaGripVertical aria-hidden />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('relative', isDragging && 'z-20 opacity-90 shadow-xl')}
    >
      {children(handle)}
    </div>
  );
}
