/** Next 14 days × time of day: which guest menu `/m/{bar}` shows when, plus overlap warnings. */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaExclamationTriangle } from 'react-icons/fa';
import { cn } from '@components/ui';
import { computeScheduleTimeline, findTimelineOverlaps, formatMinutes, type TimelineMenu } from '@lib/guest-menu/builder';
import { getScheduleNow } from '@lib/guest-menu/schedule';
import type { GuestMenuSummaryDto } from '@lib/schemas/guestMenus';

const SLOT_MINUTES = 30;
export const MENU_COLORS = ['#2563eb', '#db2777', '#16a34a', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04', '#dc2626', '#4f46e5', '#059669'];

export function ScheduleTimeline({ menus, timezone, dayStartTime }: { menus: GuestMenuSummaryDto[]; timezone: string; dayStartTime: string | null }) {
  const { t, i18n } = useTranslation('guestMenu');

  const timelineMenus: TimelineMenu[] = useMemo(
    () =>
      menus.map((menu) => ({
        id: menu.id,
        name: menu.name,
        enabled: menu.enabled,
        isDefault: menu.isDefault,
        priority: menu.priority,
        validFrom: menu.validFrom,
        validTo: menu.validTo,
        weekdays: menu.weekdays,
        timeFrom: menu.timeFrom,
        timeTo: menu.timeTo,
        isPublished: menu.isPublished,
        publishedAt: menu.publishedAt,
      })),
    [menus],
  );
  const now = useMemo(() => getScheduleNow(new Date(), { timezone, dayStartTime }), [timezone, dayStartTime]);
  const startDate = now.calendarDate ?? now.date;
  const timeline = useMemo(
    () => computeScheduleTimeline(timelineMenus, startDate, { days: 14, slotMinutes: SLOT_MINUTES, dayStartTime }),
    [timelineMenus, startDate, dayStartTime],
  );
  const overlaps = useMemo(() => findTimelineOverlaps(timeline, timelineMenus, SLOT_MINUTES), [timeline, timelineMenus]);
  const colorOf = useMemo(() => new Map(menus.map((menu, index) => [menu.id, MENU_COLORS[index % MENU_COLORS.length]])), [menus]);
  const nameOf = useMemo(() => new Map(menus.map((menu) => [menu.id, menu.name])), [menus]);

  const dayFormatter = useMemo(
    () => new Intl.DateTimeFormat(i18n.language || 'de', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
    [i18n.language],
  );
  const formatDay = (date: string) => dayFormatter.format(new Date(`${date}T00:00:00.000Z`));
  const nowSlot = Math.floor(now.minutesOfDay / SLOT_MINUTES);
  const hours = [0, 3, 6, 9, 12, 15, 18, 21];

  if (menus.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {menus.map((menu) => (
          <span key={menu.id} className={cn('flex items-center gap-1', !menu.isPublished && 'opacity-50')}>
            <span className="h-3 w-3 rounded-sm" style={{ background: colorOf.get(menu.id) }} />
            {menu.name}
            {!menu.isPublished && ` (${t('notPublished')})`}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm border border-base-300 bg-base-200" />
          {t('list.timeline.none')}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-[5.5rem_1fr] items-end gap-2 pb-1 text-[0.65rem] text-base-content/60">
            <span>{t('list.timeline.timezone', { timezone })}</span>
            <div className="relative h-4">
              {hours.map((hour) => (
                <span key={hour} className="absolute -translate-x-1/2" style={{ left: `${(hour / 24) * 100}%` }}>
                  {formatMinutes(hour * 60)}
                </span>
              ))}
            </div>
          </div>
          {timeline.map((day, dayIndex) => (
            <div key={day.date} className="grid grid-cols-[5.5rem_1fr] items-center gap-2 py-0.5">
              <span className={cn('text-xs', dayIndex === 0 && 'font-semibold')}>{formatDay(day.date)}</span>
              <div className="flex h-5 overflow-hidden rounded">
                {day.slots.map((slot, slotIndex) => {
                  const color = slot.activeMenuId ? colorOf.get(slot.activeMenuId) : undefined;
                  const label = `${formatDay(day.date)} ${formatMinutes(slot.minutes)}: ${slot.activeMenuId ? nameOf.get(slot.activeMenuId) : t('list.timeline.none')}${
                    slot.viaDefault ? ` (${t('isDefault')})` : ''
                  }`;
                  return (
                    <span
                      key={slot.minutes}
                      title={label}
                      className={cn(
                        'h-full flex-1',
                        !color && 'bg-base-200',
                        slot.viaDefault && 'opacity-60',
                        dayIndex === 0 && slotIndex === nowSlot && 'ring-2 ring-base-content ring-inset',
                      )}
                      style={color ? { background: color } : undefined}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="text-xs text-base-content/60">{t('list.timeline.hint')}</p>

      {overlaps.length > 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-warning/50 bg-warning/10 p-3 text-xs">
          <span className="flex items-center gap-2 font-semibold">
            <FaExclamationTriangle className="text-warning" /> {t('list.timeline.overlaps', { count: overlaps.length })}
          </span>
          <ul className="flex flex-col gap-0.5">
            {overlaps.slice(0, 8).map((overlap) => (
              <li key={`${overlap.date}-${overlap.from}-${overlap.menuIds.join()}`}>
                {t('list.timeline.overlapLine', {
                  day: formatDay(overlap.date),
                  from: formatMinutes(overlap.from),
                  to: formatMinutes(overlap.to),
                  menus: overlap.menuIds.map((id) => nameOf.get(id)).join(', '),
                  winner: overlap.winnerId ? nameOf.get(overlap.winnerId) : '–',
                })}
              </li>
            ))}
            {overlaps.length > 8 && <li className="text-base-content/60">{t('list.timeline.overlapsMore', { count: overlaps.length - 8 })}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
