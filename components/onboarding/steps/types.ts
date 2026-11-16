import type React from 'react';

/** Saves the current step; resolves `false` when it could not be saved (invalid input, request failed). */
export type StepSave = () => Promise<boolean>;

export interface SetupStepProps {
  workspaceId: string;
  /** The step registers its save function here; the wizard calls it on "Next". */
  saveRef: React.RefObject<StepSave | null>;
}
