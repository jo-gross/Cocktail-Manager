/**
 * Maps each ResourceApiDoc to its v1 handler export. Used by contract tests and
 * parametrized auth-matrix tests to invoke the correct handler per operation.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import type { ResourceApiDoc } from '@lib/openapi/types';

import * as actions from '@lib/api/v1/actions';
import * as apiKeys from '@lib/api/v1/apiKeys';
import * as auditLogs from '@lib/api/v1/auditLogs';
import * as calculations from '@lib/api/v1/calculations';
import * as cards from '@lib/api/v1/cards';
import * as cocktails from '@lib/api/v1/cocktails';
import * as garnishes from '@lib/api/v1/garnishes';
import * as glasses from '@lib/api/v1/glasses';
import * as ices from '@lib/api/v1/ices';
import * as ingredients from '@lib/api/v1/ingredients';
import * as joinCodes from '@lib/api/v1/joinCodes';
import * as joinRequests from '@lib/api/v1/joinRequests';
import * as leave from '@lib/api/v1/leave';
import * as me from '@lib/api/v1/me';
import * as queue from '@lib/api/v1/queue';
import * as ratings from '@lib/api/v1/ratings';
import * as signage from '@lib/api/v1/signage';
import * as statistics from '@lib/api/v1/statistics';
import * as statisticsAdvanced from '@lib/api/v1/statisticsAdvanced';
import * as tags from '@lib/api/v1/tags';
import * as translations from '@lib/api/v1/translations';
import * as units from '@lib/api/v1/units';
import * as workspace from '@lib/api/v1/workspace';
import * as workspaceUsers from '@lib/api/v1/workspaceUsers';

import { actionsCollectionApiDoc, actionsItemApiDoc } from '@lib/schemas/actions';
import { apiKeysCollectionApiDoc, apiKeysItemApiDoc } from '@lib/schemas/apiKeys';
import { auditLogsCollectionApiDoc } from '@lib/schemas/auditLogs';
import {
  calculationGroupsAssignApiDoc,
  calculationGroupsCollectionApiDoc,
  calculationGroupsItemApiDoc,
  calculationsCollectionApiDoc,
  calculationsExportJsonApiDoc,
  calculationsImportJsonApiDoc,
  calculationsItemApiDoc,
} from '@lib/schemas/calculations';
import { cardsArchiveApiDoc, cardsCloneApiDoc, cardsCollectionApiDoc, cardsItemApiDoc, cardsUnarchiveApiDoc } from '@lib/schemas/cards';
import {
  cocktailsArchiveApiDoc,
  cocktailsCheckApiDoc,
  cocktailsCloneApiDoc,
  cocktailsCollectionApiDoc,
  cocktailsExportJsonApiDoc,
  cocktailsExportPdfApiDoc,
  cocktailsImageApiDoc,
  cocktailsImportJsonApiDoc,
  cocktailsItemApiDoc,
  cocktailsUnarchiveApiDoc,
} from '@lib/schemas/cocktails';
import {
  garnishesCheckApiDoc,
  garnishesCloneApiDoc,
  garnishesCollectionApiDoc,
  garnishesExportJsonApiDoc,
  garnishesImageApiDoc,
  garnishesImportJsonApiDoc,
  garnishesItemApiDoc,
} from '@lib/schemas/garnishes';
import {
  glassesCheckApiDoc,
  glassesCloneApiDoc,
  glassesCollectionApiDoc,
  glassesExportJsonApiDoc,
  glassesImageApiDoc,
  glassesImportJsonApiDoc,
  glassesItemApiDoc,
  glassesReferencesApiDoc,
} from '@lib/schemas/glasses';
import { icesCollectionApiDoc, icesItemApiDoc } from '@lib/schemas/ices';
import {
  ingredientsCheckApiDoc,
  ingredientsCloneApiDoc,
  ingredientsCollectionApiDoc,
  ingredientsExportJsonApiDoc,
  ingredientsImageApiDoc,
  ingredientsImportJsonApiDoc,
  ingredientsItemApiDoc,
  ingredientsReferencesApiDoc,
} from '@lib/schemas/ingredients';
import { joinCodesCollectionApiDoc, joinCodesItemApiDoc } from '@lib/schemas/joinCodes';
import { joinRequestsAcceptApiDoc, joinRequestsCollectionApiDoc, joinRequestsRejectApiDoc } from '@lib/schemas/joinRequests';
import { leaveApiDoc } from '@lib/schemas/leave';
import { meApiDoc } from '@lib/schemas/me';
import { queueAddApiDoc, queueCollectionApiDoc, queueItemApiDoc, queueRemoveApiDoc } from '@lib/schemas/queue';
import { ratingsCollectionApiDoc, ratingsItemApiDoc } from '@lib/schemas/ratings';
import { signageApiDoc, signageSlideImageApiDoc, signageSlideItemApiDoc, signageSlidesApiDoc } from '@lib/schemas/signage';
import {
  statisticsCocktailsAddApiDoc,
  statisticsCocktailsCollectionApiDoc,
  statisticsCocktailsItemApiDoc,
  statisticsLogsCollectionApiDoc,
  statisticsLogsItemApiDoc,
} from '@lib/schemas/statistics';
import {
  statisticsAdvancedCocktailItemApiDoc,
  statisticsAdvancedCocktailOrdersApiDoc,
  statisticsAdvancedCocktailsAllApiDoc,
  statisticsAdvancedCocktailsApiDoc,
  statisticsAdvancedCompareApiDoc,
  statisticsAdvancedIngredientsApiDoc,
  statisticsAdvancedOverviewApiDoc,
  statisticsAdvancedSetItemApiDoc,
  statisticsAdvancedSetsApiDoc,
  statisticsAdvancedTagsApiDoc,
} from '@lib/schemas/statisticsAdvanced';
import { tagsCollectionApiDoc } from '@lib/schemas/tags';
import { translationsApiDoc } from '@lib/schemas/translations';
import { unitConversionsCollectionApiDoc, unitConversionsItemApiDoc, unitsCollectionApiDoc, unitsItemApiDoc } from '@lib/schemas/units';
import { workspaceItemApiDoc, workspaceSettingsApiDoc } from '@lib/schemas/workspace';
import { workspaceUsersCollectionApiDoc, workspaceUsersItemApiDoc } from '@lib/schemas/workspaceUsers';

export type ApiHandlerFn = (req: NextApiRequest, res: NextApiResponse) => Promise<unknown> | unknown;

export interface HandlerBinding {
  apiDoc: ResourceApiDoc;
  handler: ApiHandlerFn;
}

export const handlerBindings: HandlerBinding[] = [
  { apiDoc: actionsCollectionApiDoc, handler: actions.collectionHandler },
  { apiDoc: actionsItemApiDoc, handler: actions.itemHandler },
  { apiDoc: apiKeysCollectionApiDoc, handler: apiKeys.collectionHandler },
  { apiDoc: apiKeysItemApiDoc, handler: apiKeys.itemHandler },
  { apiDoc: auditLogsCollectionApiDoc, handler: auditLogs.collectionHandler },
  { apiDoc: calculationsCollectionApiDoc, handler: calculations.collectionHandler },
  { apiDoc: calculationsItemApiDoc, handler: calculations.itemHandler },
  { apiDoc: calculationGroupsCollectionApiDoc, handler: calculations.groupsCollectionHandler },
  { apiDoc: calculationGroupsItemApiDoc, handler: calculations.groupsItemHandler },
  { apiDoc: calculationGroupsAssignApiDoc, handler: calculations.groupsAssignHandler },
  { apiDoc: calculationsExportJsonApiDoc, handler: calculations.exportJsonHandler },
  { apiDoc: calculationsImportJsonApiDoc, handler: calculations.importJsonHandler },
  { apiDoc: cardsCollectionApiDoc, handler: cards.collectionHandler },
  { apiDoc: cardsItemApiDoc, handler: cards.itemHandler },
  { apiDoc: cardsArchiveApiDoc, handler: cards.archiveHandler },
  { apiDoc: cardsUnarchiveApiDoc, handler: cards.unarchiveHandler },
  { apiDoc: cardsCloneApiDoc, handler: cards.cloneHandler },
  { apiDoc: cocktailsCollectionApiDoc, handler: cocktails.collectionHandler },
  { apiDoc: cocktailsItemApiDoc, handler: cocktails.itemHandler },
  { apiDoc: cocktailsCheckApiDoc, handler: cocktails.checkHandler },
  { apiDoc: cocktailsImageApiDoc, handler: cocktails.imageHandler },
  { apiDoc: cocktailsCloneApiDoc, handler: cocktails.cloneHandler },
  { apiDoc: cocktailsArchiveApiDoc, handler: cocktails.archiveHandler },
  { apiDoc: cocktailsUnarchiveApiDoc, handler: cocktails.unarchiveHandler },
  { apiDoc: cocktailsExportJsonApiDoc, handler: cocktails.exportJsonHandler },
  { apiDoc: cocktailsExportPdfApiDoc, handler: cocktails.exportPdfHandler },
  { apiDoc: cocktailsImportJsonApiDoc, handler: cocktails.importJsonHandler },
  { apiDoc: garnishesCollectionApiDoc, handler: garnishes.collectionHandler },
  { apiDoc: garnishesItemApiDoc, handler: garnishes.itemHandler },
  { apiDoc: garnishesCheckApiDoc, handler: garnishes.checkHandler },
  { apiDoc: garnishesCloneApiDoc, handler: garnishes.cloneHandler },
  { apiDoc: garnishesExportJsonApiDoc, handler: garnishes.exportJsonHandler },
  { apiDoc: garnishesImportJsonApiDoc, handler: garnishes.importJsonHandler },
  { apiDoc: garnishesImageApiDoc, handler: garnishes.imageHandler },
  { apiDoc: glassesCollectionApiDoc, handler: glasses.collectionHandler },
  { apiDoc: glassesItemApiDoc, handler: glasses.itemHandler },
  { apiDoc: glassesCheckApiDoc, handler: glasses.checkHandler },
  { apiDoc: glassesCloneApiDoc, handler: glasses.cloneHandler },
  { apiDoc: glassesReferencesApiDoc, handler: glasses.referencesHandler },
  { apiDoc: glassesExportJsonApiDoc, handler: glasses.exportJsonHandler },
  { apiDoc: glassesImportJsonApiDoc, handler: glasses.importJsonHandler },
  { apiDoc: glassesImageApiDoc, handler: glasses.imageHandler },
  { apiDoc: icesCollectionApiDoc, handler: ices.collectionHandler },
  { apiDoc: icesItemApiDoc, handler: ices.itemHandler },
  { apiDoc: ingredientsCollectionApiDoc, handler: ingredients.collectionHandler },
  { apiDoc: ingredientsItemApiDoc, handler: ingredients.itemHandler },
  { apiDoc: ingredientsCheckApiDoc, handler: ingredients.checkHandler },
  { apiDoc: ingredientsCloneApiDoc, handler: ingredients.cloneHandler },
  { apiDoc: ingredientsReferencesApiDoc, handler: ingredients.referencesHandler },
  { apiDoc: ingredientsExportJsonApiDoc, handler: ingredients.exportJsonHandler },
  { apiDoc: ingredientsImportJsonApiDoc, handler: ingredients.importJsonHandler },
  { apiDoc: ingredientsImageApiDoc, handler: ingredients.imageHandler },
  { apiDoc: joinCodesCollectionApiDoc, handler: joinCodes.collectionHandler },
  { apiDoc: joinCodesItemApiDoc, handler: joinCodes.itemHandler },
  { apiDoc: joinRequestsCollectionApiDoc, handler: joinRequests.collectionHandler },
  { apiDoc: joinRequestsAcceptApiDoc, handler: joinRequests.acceptHandler },
  { apiDoc: joinRequestsRejectApiDoc, handler: joinRequests.rejectHandler },
  { apiDoc: leaveApiDoc, handler: leave.leaveHandler },
  { apiDoc: meApiDoc, handler: me.meHandler },
  { apiDoc: queueCollectionApiDoc, handler: queue.collectionHandler },
  { apiDoc: queueAddApiDoc, handler: queue.addHandler },
  { apiDoc: queueRemoveApiDoc, handler: queue.removeHandler },
  { apiDoc: queueItemApiDoc, handler: queue.itemHandler },
  { apiDoc: ratingsCollectionApiDoc, handler: ratings.collectionHandler },
  { apiDoc: ratingsItemApiDoc, handler: ratings.itemHandler },
  { apiDoc: signageApiDoc, handler: signage.signageHandler },
  { apiDoc: signageSlidesApiDoc, handler: signage.slidesHandler },
  { apiDoc: signageSlideItemApiDoc, handler: signage.slideItemHandler },
  { apiDoc: signageSlideImageApiDoc, handler: signage.slideImageHandler },
  { apiDoc: statisticsCocktailsCollectionApiDoc, handler: statistics.cocktailsCollectionHandler },
  { apiDoc: statisticsCocktailsAddApiDoc, handler: statistics.cocktailsAddHandler },
  { apiDoc: statisticsCocktailsItemApiDoc, handler: statistics.cocktailsItemHandler },
  { apiDoc: statisticsLogsCollectionApiDoc, handler: statistics.logsCollectionHandler },
  { apiDoc: statisticsLogsItemApiDoc, handler: statistics.logsItemHandler },
  { apiDoc: statisticsAdvancedOverviewApiDoc, handler: statisticsAdvanced.overviewHandler },
  { apiDoc: statisticsAdvancedCocktailsApiDoc, handler: statisticsAdvanced.cocktailsHandler },
  { apiDoc: statisticsAdvancedCocktailsAllApiDoc, handler: statisticsAdvanced.cocktailsAllHandler },
  { apiDoc: statisticsAdvancedCocktailItemApiDoc, handler: statisticsAdvanced.cocktailItemHandler },
  { apiDoc: statisticsAdvancedCocktailOrdersApiDoc, handler: statisticsAdvanced.cocktailOrdersHandler },
  { apiDoc: statisticsAdvancedIngredientsApiDoc, handler: statisticsAdvanced.ingredientsHandler },
  { apiDoc: statisticsAdvancedTagsApiDoc, handler: statisticsAdvanced.tagsHandler },
  { apiDoc: statisticsAdvancedCompareApiDoc, handler: statisticsAdvanced.compareHandler },
  { apiDoc: statisticsAdvancedSetsApiDoc, handler: statisticsAdvanced.setsHandler },
  { apiDoc: statisticsAdvancedSetItemApiDoc, handler: statisticsAdvanced.setItemHandler },
  { apiDoc: tagsCollectionApiDoc, handler: tags.collectionHandler },
  { apiDoc: translationsApiDoc, handler: translations.translationHandler },
  { apiDoc: unitsCollectionApiDoc, handler: units.collectionHandler },
  { apiDoc: unitsItemApiDoc, handler: units.itemHandler },
  { apiDoc: unitConversionsCollectionApiDoc, handler: units.conversionsCollectionHandler },
  { apiDoc: unitConversionsItemApiDoc, handler: units.conversionsItemHandler },
  { apiDoc: workspaceItemApiDoc, handler: workspace.itemHandler },
  { apiDoc: workspaceSettingsApiDoc, handler: workspace.settingsHandler },
  { apiDoc: workspaceUsersCollectionApiDoc, handler: workspaceUsers.collectionHandler },
  { apiDoc: workspaceUsersItemApiDoc, handler: workspaceUsers.itemHandler },
];

/** Lookup handler binding by basePath. */
export function findHandlerBinding(basePath: string): HandlerBinding | undefined {
  return handlerBindings.find((b) => b.apiDoc.basePath === basePath);
}
