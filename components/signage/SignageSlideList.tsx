import { useContext, useState } from 'react';
import { DndContext, DragEndEvent, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Image from 'next/image';
import { FaCalendarAlt, FaEye, FaEyeSlash, FaGripVertical, FaTrashAlt } from 'react-icons/fa';
import { Button, Checkbox, FormControl, Input, Label, LabelText } from '@components/ui';
import { DAY_ORDER_MONDAY_FIRST, getDayName } from '@lib/dayConstants';
import { formatSlideScheduleLabel } from '@lib/signage/isSlideActiveNow';
import { SignageSlideView } from '@lib/signage/types';
import { ModalContext } from '@lib/context/ModalContextProvider';
import ImageModal from '@components/modals/ImageModal';

export interface SignageSlideSchedulePayload {
  weekdays: number[];
  validFrom: string | null;
  validTo: string | null;
  dateExclusive: boolean;
}

interface SignageSlideListProps {
  slides: SignageSlideView[];
  selectedIds: Set<string>;
  onChange: (slides: SignageSlideView[]) => void;
  onToggleSelect: (slideId: string) => void;
  onToggleSelectAll: () => void;
  onToggleEnabled: (slideId: string, enabled: boolean) => Promise<void>;
  onDelete: (slideId: string) => Promise<void>;
  onScheduleApply: (slideId: string, payload: SignageSlideSchedulePayload) => Promise<void>;
}

function SlideSchedulePanel({
  slide,
  onApply,
  onClose,
}: {
  slide: SignageSlideView;
  onApply: (payload: SignageSlideSchedulePayload) => Promise<void>;
  onClose: () => void;
}) {
  const [weekdays, setWeekdays] = useState<number[]>(slide.weekdays);
  const [validFrom, setValidFrom] = useState(slide.validFrom ?? '');
  const [validTo, setValidTo] = useState(slide.validTo ?? '');
  const [dateExclusive, setDateExclusive] = useState(slide.dateExclusive);
  const [submitting, setSubmitting] = useState(false);

  const toggleWeekday = (day: number) => {
    setWeekdays((current) => (current.includes(day) ? current.filter((value) => value !== day) : [...current, day]));
  };

  const handleApply = async () => {
    setSubmitting(true);
    try {
      await onApply({
        weekdays,
        validFrom: validFrom || null,
        validTo: validTo || null,
        dateExclusive,
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-lg border border-base-300/60 bg-base-200/40 p-3">
      <div className="flex flex-wrap gap-1">
        {DAY_ORDER_MONDAY_FIRST.map((day) => (
          <Button key={day} type="button" size="sm" variant={weekdays.includes(day) ? 'primary' : 'outline'} onClick={() => toggleWeekday(day)}>
            {getDayName(day, true, true)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <FormControl>
          <Label>
            <LabelText>Startdatum</LabelText>
          </Label>
          <Input type="date" value={validFrom} onChange={(event) => setValidFrom(event.target.value)} />
        </FormControl>
        <FormControl>
          <Label>
            <LabelText>Enddatum</LabelText>
          </Label>
          <Input type="date" value={validTo} onChange={(event) => setValidTo(event.target.value)} />
        </FormControl>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <Checkbox checked={dateExclusive} onChange={() => setDateExclusive((current) => !current)} />
        <span>
          Nur in diesem Zeitraum anzeigen (ersetzt andere Karten)
          <span className="mt-0.5 block text-xs text-base-content/60">Exklusive Karten ersetzen die normale Rotation, solange sie aktiv sind.</span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="primary" size="sm" disabled={submitting} onClick={handleApply}>
          Anwenden
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Schließen
        </Button>
      </div>
    </div>
  );
}

function SortableSlideItem({
  id,
  slide,
  selected,
  expanded,
  onToggleSelect,
  onToggleEnabled,
  onToggleSchedule,
  onDelete,
  onScheduleApply,
  onCloseSchedule,
}: {
  id: string;
  slide: SignageSlideView;
  selected: boolean;
  expanded: boolean;
  onToggleSelect: () => void;
  onToggleEnabled: () => Promise<void>;
  onToggleSchedule: () => void;
  onDelete: () => Promise<void>;
  onScheduleApply: (payload: SignageSlideSchedulePayload) => Promise<void>;
  onCloseSchedule: () => void;
}) {
  const modalContext = useContext(ModalContext);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative flex flex-col rounded-lg border p-2 ${slide.enabled ? 'border-base-300/60 bg-base-100' : 'border-base-300/40 bg-base-200/60 opacity-70'}`}
    >
      <div className="flex min-h-28 items-center gap-2">
        <Checkbox checked={selected} onChange={onToggleSelect} />
        <button type="button" className="cursor-grab text-base-content/60" {...attributes} {...listeners}>
          <FaGripVertical />
        </button>
        <button
          type="button"
          className={`relative h-24 w-32 shrink-0 overflow-hidden rounded-md ${slide.enabled ? '' : 'opacity-50 grayscale'} cursor-zoom-in`}
          onClick={() => modalContext.openModal(<ImageModal image={slide.content} />)}
          title="Vorschau vergrößern"
        >
          <Image src={slide.content} alt="Monitor slide preview" fill className="object-contain" />
        </button>
        <div className="min-w-0 flex-1 text-xs text-base-content/70">{formatSlideScheduleLabel(slide)}</div>
        <div className="flex gap-1">
          <Button type="button" variant={expanded ? 'primary' : 'outline'} shape="square" size="sm" onClick={onToggleSchedule} title="Zeitplan bearbeiten">
            <FaCalendarAlt />
          </Button>
          <Button
            type="button"
            variant="outline"
            shape="square"
            size="sm"
            onClick={() => onToggleEnabled()}
            title={slide.enabled ? 'Deaktivieren' : 'Aktivieren'}
          >
            {slide.enabled ? <FaEye /> : <FaEyeSlash />}
          </Button>
          <Button type="button" variant="outline" shape="square" size="sm" className="border-error text-error hover:bg-error/10" onClick={() => onDelete()}>
            <FaTrashAlt />
          </Button>
        </div>
      </div>
      {expanded ? (
        <SlideSchedulePanel
          key={`${slide.id}-${slide.weekdays.join(',')}-${slide.validFrom ?? ''}-${slide.validTo ?? ''}-${slide.dateExclusive}`}
          slide={slide}
          onApply={onScheduleApply}
          onClose={onCloseSchedule}
        />
      ) : null}
    </div>
  );
}

export function SignageSlideList({
  slides,
  selectedIds,
  onChange,
  onToggleSelect,
  onToggleSelectAll,
  onToggleEnabled,
  onDelete,
  onScheduleApply,
}: SignageSlideListProps) {
  const [expandedSlideId, setExpandedSlideId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const ids = slides.map((slide) => slide.id);
  const allSelected = slides.length > 0 && slides.every((slide) => selectedIds.has(slide.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reordered = arrayMove(slides, oldIndex, newIndex).map((slide, index) => ({
      ...slide,
      order: index,
    }));
    onChange(reordered);
  };

  if (slides.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={allSelected} onChange={onToggleSelectAll} />
        Alle auswählen
      </label>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {slides.map((slide) => (
              <SortableSlideItem
                key={slide.id}
                id={slide.id}
                slide={slide}
                selected={selectedIds.has(slide.id)}
                expanded={expandedSlideId === slide.id}
                onToggleSelect={() => onToggleSelect(slide.id)}
                onToggleEnabled={() => onToggleEnabled(slide.id, !slide.enabled)}
                onToggleSchedule={() => setExpandedSlideId((current) => (current === slide.id ? null : slide.id))}
                onDelete={() => onDelete(slide.id)}
                onScheduleApply={(payload) => onScheduleApply(slide.id, payload)}
                onCloseSchedule={() => setExpandedSlideId(null)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
