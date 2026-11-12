/**
 * Version-agnostic business logic for cocktail-recipe step actions (v1). Returns
 * clean public DTOs and scopes every lookup and write by `workspaceId`; the
 * entity write and its display-name translation share one transaction.
 */
import prisma from '../../../prisma/prisma';
import { updateTranslation } from '@lib/translations/workspaceTranslations';
import { toActionDto } from '@lib/api/dto/actions';
import { ApiError } from '@lib/http/ApiError';
import { runTx } from '@lib/db/tx';
import type { Prisma, Workspace } from '@generated/prisma/client';
import type { ActionCreateInput, ActionDto, ActionUpdateInput } from '@lib/schemas/actions';

export async function listActions(workspace: Workspace, opts: { search?: string }): Promise<ActionDto[]> {
  const where: Prisma.WorkspaceCocktailRecipeStepActionWhereInput = { workspaceId: workspace.id };
  if (opts.search) {
    where.name = { contains: opts.search, mode: 'insensitive' };
  }
  const actions = await prisma.workspaceCocktailRecipeStepAction.findMany({ where });
  return actions.map(toActionDto);
}

export async function createAction(workspace: Workspace, input: ActionCreateInput): Promise<ActionDto> {
  const created = await runTx(async (tx) => {
    const action = await tx.workspaceCocktailRecipeStepAction.create({
      data: { name: input.name, actionGroup: input.actionGroup, dilutionPercent: input.dilutionPercent, workspaceId: workspace.id },
    });
    if (input.translations) await updateTranslation(tx, workspace.id, input.name, input.translations);
    return action;
  });
  return toActionDto(created);
}

export async function updateAction(workspace: Workspace, actionId: string, input: ActionUpdateInput): Promise<ActionDto> {
  const updated = await runTx(async (tx) => {
    const existing = await tx.workspaceCocktailRecipeStepAction.findFirst({ where: { id: actionId, workspaceId: workspace.id } });
    if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Action not found');
    const action = await tx.workspaceCocktailRecipeStepAction.update({
      where: { id: actionId, workspaceId: workspace.id },
      data: { actionGroup: input.actionGroup, dilutionPercent: input.dilutionPercent },
    });
    if (input.translations) await updateTranslation(tx, workspace.id, existing.name, input.translations);
    return action;
  });
  return toActionDto(updated);
}

function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2003';
}

/** Actions used by cocktail steps cannot be deleted (the FK is NO ACTION). */
export async function deleteAction(workspace: Workspace, actionId: string): Promise<ActionDto> {
  const existing = await prisma.workspaceCocktailRecipeStepAction.findFirst({ where: { id: actionId, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Action not found');

  const usages = await prisma.cocktailRecipeStep.count({ where: { actionId } });
  if (usages > 0) {
    const cocktails = await prisma.cocktailRecipe.findMany({
      where: { workspaceId: workspace.id, steps: { some: { actionId } } },
      select: { id: true, name: true },
    });
    throw new ApiError(409, 'ACTION_IN_USE', `The action is still used in ${cocktails.length} cocktail(s) and cannot be deleted.`, { cocktails });
  }

  try {
    const deleted = await prisma.workspaceCocktailRecipeStepAction.delete({ where: { id: actionId, workspaceId: workspace.id } });
    return toActionDto(deleted);
  } catch (error) {
    // A cocktail step started using the action after the check above.
    if (isForeignKeyViolation(error)) throw new ApiError(409, 'ACTION_IN_USE', 'The action is still used in cocktails and cannot be deleted.');
    throw error;
  }
}
