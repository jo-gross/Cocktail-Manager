/**
 * Single source for the API-key permission catalog: every Permission with a
 * human-readable description. `satisfies Record<Permission, string>` makes tsc
 * flag any drift from the Prisma `Permission` enum. Feeds the OpenAPI spec
 * (Permission component + per-operation description) and the docs matrix.
 */
import { z } from '@lib/openapi/zod';
import type { Permission } from '@generated/prisma/client';

export const PERMISSION_DESCRIPTIONS = {
  COCKTAILS_READ: 'Read cocktail recipes',
  COCKTAILS_CREATE: 'Create cocktail recipes',
  COCKTAILS_UPDATE: 'Update cocktail recipes',
  COCKTAILS_DELETE: 'Delete cocktail recipes',

  INGREDIENTS_READ: 'Read ingredients',
  INGREDIENTS_CREATE: 'Create ingredients',
  INGREDIENTS_UPDATE: 'Update ingredients',
  INGREDIENTS_DELETE: 'Delete ingredients',

  GARNISHES_READ: 'Read garnishes',
  GARNISHES_CREATE: 'Create garnishes',
  GARNISHES_UPDATE: 'Update garnishes',
  GARNISHES_DELETE: 'Delete garnishes',

  GLASSES_READ: 'Read glasses',
  GLASSES_CREATE: 'Create glasses',
  GLASSES_UPDATE: 'Update glasses',
  GLASSES_DELETE: 'Delete glasses',

  UNITS_READ: 'Read units and unit conversions',
  UNITS_UPDATE: 'Create, update, and delete units and unit conversions',

  QUEUE_READ: 'Read the cocktail queue',
  QUEUE_CREATE: 'Add cocktails to the queue',
  QUEUE_UPDATE: 'Update queue items',
  QUEUE_DELETE: 'Remove cocktails from the queue',

  STATISTICS_READ: 'Read sales statistics',
  STATISTICS_CREATE: 'Record sales statistics',
  STATISTICS_DELETE: 'Delete statistics entries',

  CARDS_READ: 'Read cocktail cards (menus)',
  CARDS_CREATE: 'Create cocktail cards',
  CARDS_UPDATE: 'Update cocktail cards',
  CARDS_DELETE: 'Delete cocktail cards',

  CALCULATIONS_READ: 'Read cost calculations',
  CALCULATIONS_CREATE: 'Create cost calculations',
  CALCULATIONS_UPDATE: 'Update cost calculations',
  CALCULATIONS_DELETE: 'Delete cost calculations',

  WORKSPACE_READ: 'Read workspace settings and audit logs',
  WORKSPACE_UPDATE: 'Update workspace settings',

  USERS_READ: 'Read workspace members',
  USERS_UPDATE: 'Update member roles',
  USERS_DELETE: 'Remove members from the workspace',

  ICE_READ: 'Read ice types',
  ICE_CREATE: 'Create ice types',
  ICE_UPDATE: 'Update ice types',
  ICE_DELETE: 'Delete ice types',

  RATINGS_READ: 'Read cocktail ratings',
  RATINGS_CREATE: 'Create cocktail ratings',
  RATINGS_DELETE: 'Delete cocktail ratings',

  MONITOR_READ: 'Read signage/monitor configuration and slides',
  MONITOR_UPDATE: 'Update signage/monitor configuration and slides',
} satisfies Record<Permission, string>;

export type PermissionName = keyof typeof PERMISSION_DESCRIPTIONS;

export const PERMISSION_NAMES = Object.keys(PERMISSION_DESCRIPTIONS) as [PermissionName, ...PermissionName[]];

export const PermissionEnum = z
  .enum(PERMISSION_NAMES)
  .openapi('Permission', { description: 'Granular API-key permission scopes. See Authentication → Permissions for the full matrix.' });
