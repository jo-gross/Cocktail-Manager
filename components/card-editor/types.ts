export type CardEditorViewMode = 'names' | 'compact' | 'preview';

export type CardEditorGroupItem = {
  cocktailId: string;
  itemNumber: number;
};

export type CardEditorGroup = {
  name: string;
  groupNumber: number;
  groupPrice?: number | null;
  items: CardEditorGroupItem[];
};

export type CardEditorFormValues = {
  name: string;
  date: string;
  groups: CardEditorGroup[];
};

export const CARD_EDITOR_VIEW_MODES: { id: CardEditorViewMode; label: string }[] = [
  { id: 'names', label: 'Editor (Übersicht)' },
  { id: 'compact', label: 'Editor (Detail)' },
  { id: 'preview', label: 'Vorschau' },
];

export type CardEditorDevice = 'mobile' | 'tablet' | 'desktop';

/** Preview orientation for phone/tablet frames (desktop has none). */
export type CardEditorOrientation = 'portrait' | 'landscape';

export const CARD_EDITOR_ORIENTATIONS: { id: CardEditorOrientation; label: string }[] = [
  { id: 'portrait', label: 'Hochformat' },
  { id: 'landscape', label: 'Querformat' },
];

/** Supported tablet sizes for the device preview. */
export type CardEditorTabletSize = 'mini' | 'pro11' | 'pro129';

export const CARD_EDITOR_TABLET_SIZES: { id: CardEditorTabletSize; label: string }[] = [
  { id: 'mini', label: 'mini' },
  { id: 'pro11', label: 'Pro 11"' },
  { id: 'pro129', label: 'Pro 12,9"' },
];

/** Portrait dimensions (width x height in CSS px) per tablet size. */
const TABLET_DIMENSIONS: Record<CardEditorTabletSize, { width: number; height: number }> = {
  mini: { width: 768, height: 1024 },
  pro11: { width: 834, height: 1194 },
  pro129: { width: 1024, height: 1366 },
};

/** Phone portrait dimensions (single supported size). */
const PHONE_DIMENSIONS = { width: 430, height: 932 };

/** Sentinel width for the desktop preview (full width, mirrors the 2xl breakpoint). */
const DESKTOP_WIDTH = 1536;

/** Layout density, mirroring the workspace page "lessItems" setting. */
export type CardEditorDensity = 'reduced' | 'wide';

export const CARD_EDITOR_DENSITIES: { id: CardEditorDensity; label: string }[] = [
  { id: 'reduced', label: 'Reduziert' },
  { id: 'wide', label: 'Breit' },
];

/** Portrait dimensions for the given device/tablet size. */
function getPortraitDimensions(device: CardEditorDevice, tabletSize: CardEditorTabletSize): { width: number; height: number } {
  if (device === 'tablet') {
    return TABLET_DIMENSIONS[tabletSize];
  }
  return PHONE_DIMENSIONS;
}

/**
 * Effective preview width. Portrait uses the shorter edge, landscape the longer one.
 * Desktop returns the 2xl sentinel width (full width, no frame).
 */
export function getEffectiveWidth(device: CardEditorDevice, tabletSize: CardEditorTabletSize, orientation: CardEditorOrientation): number {
  if (device === 'desktop') {
    return DESKTOP_WIDTH;
  }
  const { width, height } = getPortraitDimensions(device, tabletSize);
  return orientation === 'portrait' ? Math.min(width, height) : Math.max(width, height);
}

/**
 * Effective preview height (for the frame aspect ratio). Portrait uses the longer edge,
 * landscape the shorter one. Desktop returns the sentinel width (no frame).
 */
export function getEffectiveHeight(device: CardEditorDevice, tabletSize: CardEditorTabletSize, orientation: CardEditorOrientation): number {
  if (device === 'desktop') {
    return DESKTOP_WIDTH;
  }
  const { width, height } = getPortraitDimensions(device, tabletSize);
  return orientation === 'portrait' ? Math.max(width, height) : Math.min(width, height);
}

/**
 * Horizontal margin (in CSS px) subtracted from the real viewport width before comparing
 * against a preview's effective width. Accounts for page/container padding around the frame.
 */
export const PREVIEW_VIEWPORT_MARGIN = 48;

/** Default assumed viewport width used before the real window width is measured (SSR-safe). */
export const DEFAULT_VIEWPORT_WIDTH = 1920;

/** A concrete preview configuration together with its effective width. */
export interface CardEditorDeviceConfig {
  device: CardEditorDevice;
  tabletSize: CardEditorTabletSize;
  orientation: CardEditorOrientation;
  width: number;
}

/**
 * Enumerates every selectable preview configuration with its effective width, sorted from
 * widest to narrowest. Desktop ignores tablet size / orientation, so it is listed once.
 */
export function getDeviceConfigsByWidth(): CardEditorDeviceConfig[] {
  const configs: CardEditorDeviceConfig[] = [];

  for (const device of ['mobile', 'tablet', 'desktop'] as CardEditorDevice[]) {
    if (device === 'desktop') {
      configs.push({ device, tabletSize: 'mini', orientation: 'portrait', width: getEffectiveWidth(device, 'mini', 'portrait') });
      continue;
    }

    const tabletSizes = device === 'tablet' ? CARD_EDITOR_TABLET_SIZES.map((size) => size.id) : (['mini'] as CardEditorTabletSize[]);
    for (const tabletSize of tabletSizes) {
      for (const orientation of CARD_EDITOR_ORIENTATIONS.map((option) => option.id)) {
        configs.push({ device, tabletSize, orientation, width: getEffectiveWidth(device, tabletSize, orientation) });
      }
    }
  }

  return configs.sort((a, b) => b.width - a.width);
}

/**
 * Returns the widest preview configuration whose effective width fits into the available
 * width. Falls back to the narrowest configuration when nothing fits (very small viewports).
 */
export function getNearestFittingConfig(availableWidth: number): CardEditorDeviceConfig {
  const configs = getDeviceConfigsByWidth();
  return configs.find((config) => config.width <= availableWidth) ?? configs[configs.length - 1];
}

/**
 * Column count derived from the effective preview width and density, mirroring the real
 * workspace page grid. `xs` is not defined as a breakpoint, so below md (768px) the grid
 * falls back to a single column:
 *   width >= 1536 (2xl) => reduced 5 / wide 6
 *   width >= 1280 (xl)  => reduced 3 / wide 4
 *   width >= 768  (md)  => reduced 2 / wide 3
 *   otherwise           => 1
 */
export function getColumnsForWidth(width: number, density: CardEditorDensity): number {
  if (width >= 1536) {
    return density === 'reduced' ? 5 : 6;
  }
  if (width >= 1280) {
    return density === 'reduced' ? 3 : 4;
  }
  if (width >= 768) {
    return density === 'reduced' ? 2 : 3;
  }
  return 1;
}
