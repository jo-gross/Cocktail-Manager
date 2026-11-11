import type { NavigationIntent } from '@lib/navigation/navigationGuards';

export type LeaveAction = () => unknown;

export interface LeavePromptActions {
  /** Present when the page can be saved from the prompt. */
  save?: () => Promise<void>;
  discard: () => void;
  /** The prompt reports whether it is shown, so repeated navigation attempts don't stack prompts. */
  onOpenChange: (open: boolean) => void;
}

export interface LeaveGuardEnvironment {
  /** Lets the next navigation pass all navigation guards. */
  allowNextNavigation(): void;
  /** Continues a navigation that was blocked by the guard. */
  proceed(intent: NavigationIntent): void;
}

/**
 * State machine behind `useUnsavedChanges` (framework-free so it can be unit tested):
 * blocks while dirty, re-arms whenever the dirty state changes, and never prompts again after
 * save / discard until something changes.
 */
export function createLeaveGuard(environment: LeaveGuardEnvironment) {
  let dirty = false;
  let released = false;
  let promptOpen = false;
  let pendingLeave: LeaveAction | null = null;
  let onSave: (() => Promise<boolean | void>) | undefined;
  let prompt: ((actions: LeavePromptActions) => void) | undefined;

  const isBlocking = () => dirty && !released;

  const leaveNow = (leave: LeaveAction) => {
    released = true;
    environment.allowNextNavigation();
    void leave();
  };

  const openPrompt = (leave: LeaveAction) => {
    if (promptOpen || !prompt) return;
    const save = onSave;
    prompt({
      save: save
        ? async () => {
            pendingLeave = leave;
            try {
              const saved = await save();
              // Forms that redirect themselves consume the pending navigation in completeSave().
              const pending = pendingLeave;
              if (saved === true && pending) leaveNow(pending);
            } finally {
              pendingLeave = null;
            }
          }
        : undefined,
      discard: () => leaveNow(leave),
      onOpenChange: (open) => {
        promptOpen = open;
      },
    });
  };

  return {
    setDirty(next: boolean) {
      // Any change after a save / discard re-arms the guard.
      if (next !== dirty) released = false;
      dirty = next;
    },
    setOnSave(next: (() => Promise<boolean | void>) | undefined) {
      onSave = next;
    },
    /** Shows the leave prompt (save / discard / cancel). */
    setPrompt(next: (actions: LeavePromptActions) => void) {
      prompt = next;
    },
    isBlocking,
    /** Navigation guard: blocks leaving the page while dirty and shows the prompt. */
    guard(intent: NavigationIntent): boolean {
      if (intent.samePage || !isBlocking()) return false;
      openPrompt(() => environment.proceed(intent));
      return true;
    },
    confirmLeave(leave: LeaveAction) {
      if (isBlocking()) openPrompt(leave);
      else void leave();
    },
    markSaved() {
      released = true;
    },
    async completeSave(navigate: LeaveAction) {
      const pending = pendingLeave;
      pendingLeave = null;
      released = true;
      environment.allowNextNavigation();
      await (pending ?? navigate)();
    },
  };
}

export type LeaveGuard = ReturnType<typeof createLeaveGuard>;
