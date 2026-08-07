import { alertService } from '../alertService';
import { i18n } from '@lib/i18n/client';
import { ApiV1RequestError, apiV1Mutate, alertApiV1Error } from './apiV1';
import { addToQueue, removeFromQueue, updateQueueItem } from './queue';

export async function addCocktailToStatistic({
  workspaceId,
  cocktailId,
  cardId,
  actionSource,
  notes,
  setSubmitting,
  ignoreQueue,
  onSuccess,
  onNotDecidableError,
}: {
  workspaceId: string;
  cocktailId: string;
  cardId?: string | string[] | undefined;
  actionSource: 'SEARCH_MODAL' | 'CARD' | 'DETAIL_MODAL' | 'QUEUE';
  notes?: string;
  ignoreQueue?: boolean;
  setSubmitting: (submitting: boolean) => void;
  onSuccess?: () => void;
  onNotDecidableError?: (data: { _min: { id: string; createdAt: Date }; cocktailId: string; notes: string }[]) => void;
}) {
  try {
    setSubmitting(true);
    await apiV1Mutate(`/api/v1/workspaces/${workspaceId}/statistics/cocktails/add`, 'POST', {
      cocktailId,
      cocktailCardId: cardId,
      actionSource,
      notes,
      ignoreQueue,
    });
    onSuccess?.();
    alertService.success(i18n.t('cocktail:tracking.markedAsMade'));
  } catch (error) {
    if (error instanceof ApiV1RequestError && error.code === 'STATISTIC_QUEUE_AMBIGUOUS') {
      onNotDecidableError?.(error.issues as { _min: { id: string; createdAt: Date }; cocktailId: string; notes: string }[]);
    } else {
      alertApiV1Error(error, i18n.t('errors:addToStatistic'));
    }
  } finally {
    setSubmitting(false);
  }
}

export async function addCocktailToQueue({
  workspaceId,
  cocktailId,
  notes,
  amount,
  setSubmitting,
  onSuccess,
}: {
  workspaceId: string;
  cocktailId: string;
  notes?: string;
  amount?: number;
  setSubmitting: (submitting: boolean) => void;
  onSuccess?: () => void;
}) {
  try {
    setSubmitting(true);
    await addToQueue(workspaceId, { cocktailId, notes, amount });
    if (onSuccess) {
      onSuccess();
    } else {
      alertService.info(i18n.t('cocktail:tracking.addedToQueue'));
    }
  } catch (error) {
    alertApiV1Error(error, i18n.t('errors:addToQueue'));
  } finally {
    setSubmitting(false);
  }
}

export async function removeCocktailFromQueue({
  workspaceId,
  cocktailId,
  notes,
  setSubmitting,
  reload,
}: {
  workspaceId: string;
  cocktailId: string;
  notes?: string;
  setSubmitting: (submitting: boolean) => void;
  reload?: () => void;
}) {
  try {
    setSubmitting(true);
    await removeFromQueue(workspaceId, { cocktailId, notes });
    reload?.();
  } catch (error) {
    alertApiV1Error(error, i18n.t('errors:removeFromQueue'));
  } finally {
    setSubmitting(false);
  }
}

export async function changeQueueProcess({
  workspaceId,
  cocktailQueueItemId,
  inProgress,
  setSubmitting,
  onSuccess,
}: {
  workspaceId: string;
  cocktailQueueItemId: string;
  inProgress: boolean;
  setSubmitting: (submitting: boolean) => void;
  onSuccess?: () => void;
}) {
  try {
    setSubmitting(true);
    await updateQueueItem(workspaceId, cocktailQueueItemId, { inProgress });
    onSuccess?.();
  } catch (error) {
    alertApiV1Error(error, i18n.t('errors:updateQueueItem'));
  } finally {
    setSubmitting(false);
  }
}
