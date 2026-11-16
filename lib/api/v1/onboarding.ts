/** v1 handler wiring for the setup state and checklist of a workspace. */
import { onboardingApiDoc, onboardingCompleteApiDoc } from '@lib/schemas/onboarding';
import { defineApiHandlers } from '@lib/openapi/apiDoc';
import * as onboarding from '@lib/api/controllers/onboarding';

export const onboardingHandler = defineApiHandlers(onboardingApiDoc.operations, {
  GET: ({ workspace }) => onboarding.getOnboarding(workspace),
});

export const completeHandler = defineApiHandlers(onboardingCompleteApiDoc.operations, {
  POST: ({ workspace }) => onboarding.completeOnboarding(workspace),
});
