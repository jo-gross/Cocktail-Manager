/** Values of the portal handoff shared by server and browser code. Pure module (no node:crypto). */
export const HANDOFF_INTENTS = ['manage', 'upgrade'] as const;
export const HANDOFF_LOCALES = ['de', 'en'] as const;

export type HandoffIntent = (typeof HANDOFF_INTENTS)[number];
export type HandoffLocale = (typeof HANDOFF_LOCALES)[number];
