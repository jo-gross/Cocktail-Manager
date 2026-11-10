export interface SignageSlideOrderPayload {
  id: string;
  order: number;
}

export type SignageBackgroundMode = 'COLOR' | 'BLURRED';

export interface SignageFormatSettingsPayload {
  backgroundColor?: string | null;
  backgroundMode?: SignageBackgroundMode;
  slideDurationSeconds: number;
  mirrorSourceFormat?: 'LANDSCAPE' | 'PORTRAIT' | null;
  slides: SignageSlideOrderPayload[];
}

export interface SignageSettingsUpdatePayload {
  landscape?: SignageFormatSettingsPayload;
  portrait?: SignageFormatSettingsPayload;
}

export interface SignageSlideCreatePayload {
  format: 'LANDSCAPE' | 'PORTRAIT';
  slides: string[];
}

export interface SignageSlidePatchPayload {
  slideIds: string[];
  enabled?: boolean;
  weekdays?: number[];
  validFrom?: string | null;
  validTo?: string | null;
  dateExclusive?: boolean;
}

export type SignageSlideType = 'IMAGE' | 'GUEST_MENU';

/** Per-slide overrides for guest menu slides; unset = the menu's `outputs.monitor` setting. */
export interface GuestMenuSlideOptions {
  localeMode?: 'primary' | 'fixed' | 'rotate' | null;
  locale?: string | null;
  showQrCode?: boolean | null;
  columns?: 'auto' | number | null;
  pageDurationSeconds?: number | null;
}

export interface SignageSlideView {
  id: string;
  /** Image src for IMAGE slides; '' for GUEST_MENU slides. */
  content: string;
  /** Missing in old payloads = IMAGE. */
  type?: SignageSlideType;
  /** GUEST_MENU: shown menu, null = currently active menu. */
  guestMenuId?: string | null;
  /** GUEST_MENU: slug of `guestMenuId` (public menu endpoint). */
  guestMenuSlug?: string | null;
  /** Admin only. */
  guestMenuName?: string | null;
  /**
   * GUEST_MENU: signed access tokens for protected menus (the fixed menu, or all
   * protected menus for "active menu" slides). Sent as `X-Guest-Menu-Access`;
   * refreshed with every signage poll (`/api/signage/{id}`).
   */
  guestMenuAccessTokens?: string[];
  options?: GuestMenuSlideOptions | null;
  order: number;
  enabled: boolean;
  weekdays: number[];
  validFrom?: string | null;
  validTo?: string | null;
  dateExclusive: boolean;
}

export interface SignageFormatView {
  workspaceId: string;
  format: 'LANDSCAPE' | 'PORTRAIT';
  backgroundColor?: string | null;
  backgroundMode: SignageBackgroundMode;
  slideDurationSeconds: number;
  mirrorSourceFormat?: 'LANDSCAPE' | 'PORTRAIT' | null;
  slides: SignageSlideView[];
}

export type SignageSlideFilterMode = 'all' | 'activeNow' | 'weekday' | 'dateRange';

export interface SignageSlideFilterState {
  mode: SignageSlideFilterMode;
  weekday?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExclusiveConflict {
  slideId: string;
  label: string;
}
