/**
 * Pure helpers for the guest menu builder and the menu overview
 * (components/guest-menu/builder, pages/workspaces/[workspaceId]/manage/guest-menus).
 * No React, no Prisma – safe for client bundles and unit tests.
 */
import { createBlockId, type Block, type BlockType, type GuestMenuDocument, type GuestMenuOutput, type LocalizedText, type ThemeColors } from './schema';
import { describeMenuValidity, resolveActiveMenu, type GuestMenuScheduleFields, type ResolvableGuestMenu, type ScheduleNow } from './schedule';

// ---------------------------------------------------------------------------
// Contrast (WCAG 2.x)
// ---------------------------------------------------------------------------

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` → [r, g, b] (0–255); alpha is ignored. */
export function parseHexColor(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3,8})$/i.exec(value.trim());
  if (!match) return null;
  let hex = match[1];
  if (hex.length === 3 || hex.length === 4) hex = hex.slice(0, 3).replace(/./g, (c) => c + c);
  else if (hex.length === 8) hex = hex.slice(0, 6);
  else if (hex.length !== 6) return null;
  return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
}

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(color: string): number | null {
  const rgb = parseHexColor(color);
  if (!rgb) return null;
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** WCAG contrast ratio (1–21), `null` for invalid colors. */
export function contrastRatio(foreground: string, background: string): number | null {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  if (a == null || b == null) return null;
  const [light, dark] = a > b ? [a, b] : [b, a];
  return (light + 0.05) / (dark + 0.05);
}

export interface ContrastCheck {
  id: 'textOnBg' | 'textOnSurface' | 'mutedOnBg' | 'accentContrast';
  foreground: keyof ThemeColors;
  background: keyof ThemeColors;
  /** AA minimum: 4.5 for body text, 3 for secondary/large text. */
  minimum: number;
  ratio: number | null;
  ok: boolean;
}

const CONTRAST_PAIRS: Omit<ContrastCheck, 'ratio' | 'ok'>[] = [
  { id: 'textOnBg', foreground: 'text', background: 'bg', minimum: 4.5 },
  { id: 'textOnSurface', foreground: 'text', background: 'surface', minimum: 4.5 },
  { id: 'mutedOnBg', foreground: 'muted', background: 'bg', minimum: 3 },
  { id: 'accentContrast', foreground: 'accentContrast', background: 'accent', minimum: 4.5 },
];

export function checkThemeContrast(colors: ThemeColors): ContrastCheck[] {
  return CONTRAST_PAIRS.map((pair) => {
    const ratio = contrastRatio(colors[pair.foreground], colors[pair.background]);
    return { ...pair, ratio, ok: ratio != null && ratio >= pair.minimum };
  });
}

// ---------------------------------------------------------------------------
// Translations
// ---------------------------------------------------------------------------

export interface LocalizedEntry {
  /** Human-readable location, e.g. `title`, `block:<id>.content`. */
  path: string;
  blockId: string | null;
  text: LocalizedText;
}

/** All localized texts of a document that have content in at least one locale. */
export function collectLocalizedTexts(document: GuestMenuDocument): LocalizedEntry[] {
  const entries: LocalizedEntry[] = [];
  const push = (path: string, blockId: string | null, text: LocalizedText | null | undefined) => {
    if (text && Object.values(text).some((value) => value.trim() !== '')) entries.push({ path, blockId, text });
  };
  push('title', null, document.title);
  push('subtitle', null, document.subtitle);
  for (const block of document.blocks) {
    switch (block.type) {
      case 'section':
        push('title', block.id, block.title);
        push('description', block.id, block.description);
        for (const [cocktailId, override] of Object.entries(block.overrides)) push(`override:${cocktailId}`, block.id, override.description);
        break;
      case 'text':
        push('content', block.id, block.content);
        break;
      case 'image':
        push('alt', block.id, block.alt);
        break;
      case 'notice':
        push('text', block.id, block.text);
        break;
    }
  }
  for (const [key, text] of Object.entries(document.noticeTexts ?? {})) push(`notice:${key}`, null, text);
  return entries;
}

export interface TranslationProgress {
  locale: string;
  total: number;
  translated: number;
  /** Entries without a value in this locale (fallback is used). */
  missing: LocalizedEntry[];
}

export function getTranslationProgress(document: GuestMenuDocument, locale: string): TranslationProgress {
  const entries = collectLocalizedTexts(document);
  const missing = entries.filter((entry) => !entry.text[locale]?.trim());
  return { locale, total: entries.length, translated: entries.length - missing.length, missing };
}

/** Sets `text[locale]`; empty values remove the key. */
export function setLocalized(text: LocalizedText | null | undefined, locale: string, value: string): LocalizedText {
  const next = { ...(text ?? {}) };
  if (value === '') delete next[locale];
  else next[locale] = value;
  return next;
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

export const ADDABLE_BLOCK_TYPES: BlockType[] = ['section', 'text', 'image', 'notice', 'divider', 'header'];

export function createBlock(type: BlockType, locale: string): Block {
  switch (type) {
    case 'header':
      return { id: createBlockId('header'), type, showLogo: true, showTitle: true, showSubtitle: true };
    case 'section':
      return { id: createBlockId('section'), type, title: {}, source: { kind: 'manual', cocktailIds: [] }, overrides: {} };
    case 'text':
      return { id: createBlockId('text'), type, content: { [locale]: '' } };
    case 'image':
      return { id: createBlockId('image'), type, src: '' };
    case 'divider':
      return { id: createBlockId('divider'), type };
    case 'notice':
      return { id: createBlockId('notice'), type, preset: 'allergens' };
  }
}

/** Deep copy with a fresh id (overrides etc. are copied). */
export function duplicateBlock(block: Block): Block {
  const copy = structuredClone(block);
  copy.id = createBlockId(block.type);
  return copy;
}

/**
 * Blocks that would fail schema validation (image without source, custom notice
 * without text, card group not chosen yet) – the builder keeps them local until completed.
 */
export function isBlockIncomplete(block: Block): boolean {
  return (
    (block.type === 'image' && block.src === '') ||
    (block.type === 'notice' && block.preset === 'custom' && !block.text) ||
    (block.type === 'section' && block.source.kind === 'cardGroup' && block.source.groupId === '')
  );
}

/** Document as sent to `PUT /draft`: drops incomplete blocks (image without src, custom notice without text). */
export function toSavableDocument(document: GuestMenuDocument): GuestMenuDocument {
  if (!document.blocks.some(isBlockIncomplete)) return document;
  return { ...document, blocks: document.blocks.filter((block) => !isBlockIncomplete(block)) };
}

/**
 * Maps a preview section id (`blockId` or `blockId:groupId` for expanded
 * `cardAllGroups` sections) to the document block id.
 */
export function sectionIdToBlockId(sectionId: string, document: Pick<GuestMenuDocument, 'blocks'>): string | null {
  if (document.blocks.some((block) => block.id === sectionId)) return sectionId;
  const index = sectionId.indexOf(':');
  if (index > 0) {
    const blockId = sectionId.slice(0, index);
    if (document.blocks.some((block) => block.id === blockId)) return blockId;
  }
  return null;
}

export function isOutputVisible(block: Block, output: GuestMenuOutput): boolean {
  return block.outputs?.[output] !== false;
}

export function setOutputVisible(block: Block, output: GuestMenuOutput, visible: boolean): Block {
  const outputs = { ...(block.outputs ?? {}) };
  if (visible) delete outputs[output];
  else outputs[output] = false;
  return { ...block, outputs: Object.keys(outputs).length > 0 ? outputs : undefined } as Block;
}

// ---------------------------------------------------------------------------
// Undo / redo history
// ---------------------------------------------------------------------------

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** Key of the last change; consecutive changes with the same key are merged (typing). */
  lastKey: string | null;
  lastAt: number;
}

export const HISTORY_LIMIT = 100;
export const HISTORY_MERGE_MS = 1200;

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

export function pushHistory<T>(history: History<T>, next: T, key: string | null = null, now = Date.now()): History<T> {
  if (Object.is(next, history.present)) return history;
  const merge = key != null && key === history.lastKey && now - history.lastAt < HISTORY_MERGE_MS;
  const past = merge ? history.past : [...history.past, history.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastKey: key, lastAt: now };
}

export function undoHistory<T>(history: History<T>): History<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  return { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future], lastKey: null, lastAt: 0 };
}

export function redoHistory<T>(history: History<T>): History<T> {
  if (history.future.length === 0) return history;
  const [next, ...future] = history.future;
  return { past: [...history.past, history.present], present: next, future, lastKey: null, lastAt: 0 };
}

// ---------------------------------------------------------------------------
// Schedule timeline (menu overview)
// ---------------------------------------------------------------------------

export interface TimelineMenu extends GuestMenuScheduleFields {
  id: string;
  name: string;
  isDefault: boolean;
  priority: number;
  isPublished: boolean;
  publishedAt: string | null;
}

export interface TimelineSlot {
  /** Minutes since local (calendar) midnight. */
  minutes: number;
  /** Menu shown at `/m/{bar}` (`null` = no menu). */
  activeMenuId: string | null;
  /** Enabled menus whose schedule matches (published or not). */
  validMenuIds: string[];
  /** Shown via `isDefault` because no schedule matched. */
  viaDefault: boolean;
}

export interface TimelineDay {
  /** Calendar date `YYYY-MM-DD`. */
  date: string;
  weekday: number;
  slots: TimelineSlot[];
}

export interface TimelineOverlap {
  date: string;
  from: number;
  to: number;
  menuIds: string[];
  winnerId: string | null;
}

function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function weekdayOf(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
}

function parseMinutes(value: string | null | undefined): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
}

/**
 * Which menu is shown when, for `days` calendar days starting at `startDate`
 * (workspace timezone), sampled every `slotMinutes`. Unpublished menus count
 * as candidates for `validMenuIds` but are never active (same as `/m/{bar}`).
 */
export function computeScheduleTimeline(
  menus: readonly TimelineMenu[],
  startDate: string,
  options: { days?: number; slotMinutes?: number; dayStartTime?: string | null } = {},
): TimelineDay[] {
  const days = options.days ?? 14;
  const slotMinutes = options.slotMinutes ?? 30;
  const dayStart = parseMinutes(options.dayStartTime);
  const resolvable: (ResolvableGuestMenu & { name: string })[] = menus.map((menu) => ({
    ...menu,
    published: menu.isPublished ? true : null,
    publishedAt: menu.publishedAt,
  }));

  const result: TimelineDay[] = [];
  for (let d = 0; d < days; d++) {
    const date = addDays(startDate, d);
    const weekday = weekdayOf(date);
    const slots: TimelineSlot[] = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += slotMinutes) {
      const barDate = minutes < dayStart ? addDays(date, -1) : date;
      const now: ScheduleNow = { date: barDate, weekday: weekdayOf(barDate), minutesOfDay: minutes, calendarDate: date, calendarWeekday: weekday };
      const validMenuIds = menus.filter((menu) => describeMenuValidity(menu, now).valid).map((menu) => menu.id);
      const active = resolveActiveMenu(resolvable, now);
      slots.push({ minutes, activeMenuId: active?.id ?? null, validMenuIds, viaDefault: active != null && !validMenuIds.includes(active.id) });
    }
    result.push({ date, weekday, slots });
  }
  return result;
}

export function hasScheduleRestriction(menu: GuestMenuScheduleFields): boolean {
  return !!(menu.validFrom || menu.validTo || menu.weekdays.length > 0 || menu.timeFrom || menu.timeTo);
}

/**
 * Consecutive slots in which two or more published menus *with a schedule* are
 * valid at the same time (menus without any restriction always apply and are
 * expected to be overruled by priority, so they are not reported).
 */
export function findTimelineOverlaps(timeline: TimelineDay[], menus: readonly TimelineMenu[], slotMinutes = 30): TimelineOverlap[] {
  const published = new Set(menus.filter((menu) => menu.isPublished && menu.enabled && hasScheduleRestriction(menu)).map((menu) => menu.id));
  const overlaps: TimelineOverlap[] = [];
  for (const day of timeline) {
    let current: TimelineOverlap | null = null;
    for (const slot of day.slots) {
      const ids = slot.validMenuIds.filter((id) => published.has(id));
      const key = ids.join('|');
      if (ids.length >= 2) {
        if (current && current.menuIds.join('|') === key && current.to === slot.minutes) {
          current.to = slot.minutes + slotMinutes;
        } else {
          current = { date: day.date, from: slot.minutes, to: slot.minutes + slotMinutes, menuIds: ids, winnerId: slot.activeMenuId };
          overlaps.push(current);
        }
      } else {
        current = null;
      }
    }
  }
  return overlaps;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(minutes >= 24 * 60 ? 24 : h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
