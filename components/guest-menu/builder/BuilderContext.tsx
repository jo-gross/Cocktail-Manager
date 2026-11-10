import { createContext, useContext } from 'react';
import type { Block, GuestMenuDocument, GuestMenuOutput } from '@lib/guest-menu/schema';
import type { GuestMenuDto } from '@lib/schemas/guestMenus';
import type { GuestMenuRenderResult } from '@lib/network/guestMenus';
import type { BuilderData } from './useBuilderData';

/** Preview target: document output + monitor orientation. */
export type PreviewMode = 'web' | 'monitor-landscape' | 'monitor-portrait' | 'print';
export type PreviewDevice = 'phone' | 'tablet' | 'desktop';

export function previewModeToOutput(mode: PreviewMode): GuestMenuOutput {
  return mode === 'web' ? 'web' : mode === 'print' ? 'print' : 'monitor';
}

export interface BuilderSelection {
  blockId: string;
  /** Cocktail id when an item was clicked in the preview. */
  itemId?: string | null;
}

export interface BuilderContextValue {
  workspaceId: string;
  menu: GuestMenuDto;
  setMenu: (menu: GuestMenuDto) => void;
  document: GuestMenuDocument;
  /** Applies a change (undoable). Changes with the same `mergeKey` in quick succession form one undo step. */
  update: (recipe: (document: GuestMenuDocument) => GuestMenuDocument, mergeKey?: string) => void;
  updateBlock: (blockId: string, recipe: (block: Block) => Block, mergeKey?: string) => void;
  /** Current content locale being edited/previewed. */
  locale: string;
  primaryLocale: string;
  /** Menu locales (menu.locales or workspace content locales), primary first. */
  locales: string[];
  output: GuestMenuOutput;
  previewMode: PreviewMode;
  selection: BuilderSelection | null;
  select: (selection: BuilderSelection | null) => void;
  data: BuilderData;
  preview: GuestMenuRenderResult | null;
  canEdit: boolean;
}

export const BuilderContext = createContext<BuilderContextValue | null>(null);

export function useBuilder(): BuilderContextValue {
  const value = useContext(BuilderContext);
  if (!value) throw new Error('useBuilder must be used inside <BuilderContext.Provider>');
  return value;
}
