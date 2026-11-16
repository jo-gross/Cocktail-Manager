import type React from 'react';

export interface StepLeave {
  /** `next`: the primary button; `stepper`: a jump via the stepper. */
  via: 'next' | 'stepper';
  /** The target lies after the current step. */
  forward: boolean;
  /** Navigates to the target without saving again (for steps that first ask the user and resolve `false`). */
  proceed: () => void;
}

/** Saves the current step; resolves `false` when it could not be saved (invalid input, request failed, user asked). */
export type StepSave = (leave: StepLeave) => Promise<boolean>;

export interface SetupStepProps {
  workspaceId: string;
  /** The step registers its save function here; the wizard calls it on "Next". */
  saveRef: React.RefObject<StepSave | null>;
}
