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

export interface SignageSlideView {
  id: string;
  content: string;
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
