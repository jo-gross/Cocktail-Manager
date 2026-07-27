/**
 * Version-agnostic business logic for cocktail-recipe step actions (v1). Same DB
 * operations as the legacy handlers, but returns clean public DTOs and scopes
 * item lookups by `workspaceId` (the legacy PUT/DELETE looked up by bare id).
 */
import prisma from '../../../prisma/prisma';
import { updateTranslation } from '../../../pages/api/workspaces/[workspaceId]/admin/translation';
import { toActionDto } from '@lib/api/dto/actions';
import { ApiError } from '@lib/http/ApiError';
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
  if (input.translations) {
    await updateTranslation(workspace.id, input.name, input.translations);
  }
  const created = await prisma.workspaceCocktailRecipeStepAction.create({
    data: { name: input.name, actionGroup: input.actionGroup, workspace: { connect: { id: workspace.id } } },
  });
  return toActionDto(created);
}

export async function updateAction(workspace: Workspace, actionId: string, input: ActionUpdateInput): Promise<ActionDto> {
  const existing = await prisma.workspaceCocktailRecipeStepAction.findFirst({ where: { id: actionId, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Action not found');

  const updated = await prisma.workspaceCocktailRecipeStepAction.update({ where: { id: actionId }, data: { actionGroup: input.actionGroup } });
  if (input.translations) {
    await updateTranslation(workspace.id, existing.name, input.translations);
  }
  return toActionDto(updated);
}

export async function deleteAction(workspace: Workspace, actionId: string): Promise<ActionDto> {
  const existing = await prisma.workspaceCocktailRecipeStepAction.findFirst({ where: { id: actionId, workspaceId: workspace.id } });
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Action not found');

  const deleted = await prisma.workspaceCocktailRecipeStepAction.delete({ where: { id: actionId } });
  return toActionDto(deleted);
}
