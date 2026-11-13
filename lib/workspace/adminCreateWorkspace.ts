/**
 * Instance-admin workspace creation (`POST /api/admin/workspace` and its legacy
 * alias `POST /api/admin/workspaces`): master key only, creates an empty workspace
 * (no members) with defaults and a reusable join code.
 */
import { randomInt } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { checkMasterApiKey } from '@middleware/api/jwtApiKeyMiddleware';
import { regenerateUnitConversions } from '@lib/api/controllers/units';
import { sendFail } from '@lib/http/responses';
import { createWorkspaceWithDefaults } from '@lib/workspace/createWorkspaceWithDefaults';

export const AdminCreateWorkspaceBodySchema = z.object({
  name: z.string().trim().min(1).max(200),
});

const JOIN_CODE_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const JOIN_CODE_ATTEMPTS = 5;

function generateJoinCode(length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) code += JOIN_CODE_ALPHABET[randomInt(JOIN_CODE_ALPHABET.length)];
  return code;
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';
}

export async function adminCreateWorkspaceHandler(req: NextApiRequest, res: NextApiResponse) {
  if (!checkMasterApiKey(req)) {
    return sendFail(res, 401, 'UNAUTHORIZED', 'Master API key required');
  }

  const parsed = AdminCreateWorkspaceBodySchema.safeParse(req.body);
  if (!parsed.success) return sendFail(res, 400, 'VALIDATION_ERROR', 'Workspace name is required', parsed.error.issues);

  // Workspace + join code are one nested create (atomic); a join-code collision rolls it back and is retried.
  for (let attempt = 1; ; attempt++) {
    const joinCode = generateJoinCode();
    try {
      const workspace = await createWorkspaceWithDefaults({ name: parsed.data.name, joinCode });
      await regenerateUnitConversions(workspace.id);
      return res.json({ data: { workspace: { id: workspace.id, name: workspace.name }, joinCode } });
    } catch (error) {
      if (attempt < JOIN_CODE_ATTEMPTS && isUniqueViolation(error)) continue;
      throw error;
    }
  }
}
