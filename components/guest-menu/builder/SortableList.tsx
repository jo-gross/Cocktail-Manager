/** Minimal vertical dnd-kit list with a drag handle (keyboard sortable too). */
import type { ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MdDragIndicator } from 'react-icons/md';
import { cn } from '@components/ui';

export interface DragHandleProps {
  attributes: Record<string, unknown>;
  listeners: Record<string, unknown> | undefined;
  disabled?: boolean;
  label: string;
}

export function DragHandle({ attributes, listeners, disabled, label }: DragHandleProps) {
  return (
    <button
      type="button"
      {...attributes}
      {...listeners}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-base-content/40 hover:text-base-content pointer-coarse:h-11 pointer-coarse:w-8',
        disabled && 'invisible',
      )}
      onClick={(event) => event.stopPropagation()}
    >
      <MdDragIndicator />
    </button>
  );
}

function SortableRow({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: (handle: Omit<DragHandleProps, 'label'>, isDragging: boolean) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('relative', isDragging && 'z-10 opacity-80')}>
      {children(
        { attributes: attributes as unknown as Record<string, unknown>, listeners: listeners as Record<string, unknown> | undefined, disabled },
        isDragging,
      )}
    </li>
  );
}

export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
  disabled,
  className,
}: {
  items: T[];
  getId: (item: T) => string;
  onReorder: (items: T[]) => void;
  renderItem: (item: T, handle: Omit<DragHandleProps, 'label'>, isDragging: boolean) => ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={cn('flex flex-col gap-1', className)}>
          {items.map((item) => (
            <SortableRow key={getId(item)} id={getId(item)} disabled={disabled}>
              {(handle, isDragging) => renderItem(item, handle, isDragging)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
