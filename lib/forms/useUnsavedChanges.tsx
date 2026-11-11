import React, { createContext, useCallback, useContext, useEffect, useId, useMemo, useState } from 'react';
import { ModalContext } from '@lib/context/ModalContextProvider';
import { NAVIGATION_GUARD_PRIORITY, navigationGuards } from '@lib/navigation/navigationGuards';
import { NotSavedLeaveConfirmation } from '@components/modals/NotSavedLeaveConfirmation';
import { createLeaveGuard, type LeaveAction, type LeavePromptActions } from './leaveGuard';

export interface UnsavedChangesOptions {
  /** Dirty state owned by the page itself; combined with all sources reported via {@link useReportUnsavedChanges}. */
  dirty: boolean;
  /**
   * "Save" action of the leave prompt (omit to only offer cancel / discard).
   * Resolve to `true` when saved – the blocked navigation then continues. Forms that redirect
   * themselves after saving call {@link UnsavedChangesController.completeSave} instead.
   */
  onSave?: () => Promise<boolean | void>;
}

export interface UnsavedChangesController {
  /** Combined dirty state (page + reported sources). */
  dirty: boolean;
  /** Runs `leave` right away when nothing is unsaved, otherwise after the user confirmed the prompt. */
  confirmLeave(leave: LeaveAction): void;
  /** Synchronously treats the current state as saved until something changes again. */
  markSaved(): void;
  /**
   * Call after a successful save / archive / delete instead of redirecting directly: marks the state
   * as saved and continues the navigation that was blocked by the leave prompt ("Save" button) –
   * or runs `navigate` (the default redirect).
   */
  completeSave(navigate: LeaveAction): Promise<void>;
  /** @internal used by {@link useReportUnsavedChanges} */
  setSource(id: string, dirty: boolean): void;
}

const passthroughController: UnsavedChangesController = {
  dirty: false,
  confirmLeave: (leave) => void leave(),
  markSaved: () => {},
  completeSave: async (navigate) => {
    await navigate();
  },
  setSource: () => {},
};

export const UnsavedChangesContext = createContext<UnsavedChangesController>(passthroughController);

/** Access the unsaved-changes controller of the surrounding page (pass-through outside of one, e.g. in modals). */
export function useUnsavedChangesContext(): UnsavedChangesController {
  return useContext(UnsavedChangesContext);
}

/**
 * Reports a dirty source (form, translation tabs, settings section, …) to the surrounding page.
 * All sources of a page are combined into one leave guard.
 */
export function useReportUnsavedChanges(dirty: boolean) {
  const { setSource } = useContext(UnsavedChangesContext);
  const id = useId();
  useEffect(() => {
    setSource(id, dirty);
  }, [setSource, id, dirty]);
  useEffect(() => () => setSource(id, false), [setSource, id]);
}

/** Tracks whether the leave prompt is mounted, so a second navigation attempt doesn't stack another one. */
function LeavePrompt({ actions }: { actions: LeavePromptActions }) {
  const { onOpenChange } = actions;
  useEffect(() => {
    onOpenChange(true);
    return () => onOpenChange(false);
  }, [onOpenChange]);
  return <NotSavedLeaveConfirmation onSave={actions.save} onNotSave={actions.discard} />;
}

/**
 * Leave protection for a page with unsaved changes:
 * - in-app navigation (links, `router.push`) and browser back/forward show the leave prompt
 *   (save / discard / cancel) via the shared `navigationGuards` registry,
 * - closing / reloading the tab triggers the browser's `beforeunload` dialog,
 * - after save / discard / `completeSave` nothing prompts again until the state changes.
 *
 * Provide the returned controller via {@link UnsavedChangesContext} so children can report
 * dirty sources and complete saves (ManageEntityLayout does this for all manage pages).
 */
export function useUnsavedChanges({ dirty, onSave }: UnsavedChangesOptions): UnsavedChangesController {
  const modalContext = useContext(ModalContext);
  const [sources, setSources] = useState<Record<string, boolean>>({});
  const combinedDirty = dirty || Object.values(sources).some(Boolean);

  const [leaveGuard] = useState(() =>
    createLeaveGuard({
      allowNextNavigation: () => navigationGuards.allowNextNavigation(),
      proceed: (intent) => navigationGuards.proceed(intent),
    }),
  );

  useEffect(() => {
    leaveGuard.setDirty(combinedDirty);
  }, [leaveGuard, combinedDirty]);
  useEffect(() => {
    leaveGuard.setOnSave(onSave);
    leaveGuard.setPrompt((actions) => modalContext.openModal(<LeavePrompt actions={actions} />));
  });

  useEffect(() => navigationGuards.register((intent) => leaveGuard.guard(intent), { priority: NAVIGATION_GUARD_PRIORITY.unsavedChanges }), [leaveGuard]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!leaveGuard.isBlocking()) return;
      event.preventDefault();
      // Legacy browsers only show the dialog when returnValue is set.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [leaveGuard]);

  const setSource = useCallback((id: string, sourceDirty: boolean) => {
    setSources((previous) => {
      if ((previous[id] ?? false) === sourceDirty) return previous;
      const next = { ...previous };
      if (sourceDirty) next[id] = true;
      else delete next[id];
      return next;
    });
  }, []);

  return useMemo(
    () => ({
      dirty: combinedDirty,
      confirmLeave: leaveGuard.confirmLeave,
      markSaved: leaveGuard.markSaved,
      completeSave: leaveGuard.completeSave,
      setSource,
    }),
    [combinedDirty, leaveGuard, setSource],
  );
}
