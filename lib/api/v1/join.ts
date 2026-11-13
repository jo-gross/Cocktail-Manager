/**
 * POST /api/v1/workspaces/join?code=… — join a workspace with a join code (session only).
 *
 * - Workspace without members: the caller becomes its OWNER and the code is consumed.
 * - Otherwise a join request is created (managers are notified by e-mail after commit).
 *
 * `used` is incremented atomically (`updateMany` with the conditions in `where` + count check), so a
 * one-time code yields exactly one join request even under concurrent use. Attempts are rate-limited
 * per user because codes are global and could otherwise be guessed.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import HTTPMethod from 'http-method-enum';
import { z } from 'zod';
import { Role } from '@generated/prisma/client';
import type { User } from '@generated/prisma/client';
import { withHttpMethods } from '@middleware/api/handleMethods';
import { withAuthentication } from '@middleware/api/authenticationMiddleware';
import { ApiError } from '@lib/http/ApiError';
import { sendFail, sendOk } from '@lib/http/responses';
import { TokenBucketRateLimiter } from '@lib/http/rateLimit';
import { lockWorkspaceScope, runTx } from '@lib/db/tx';
import { sendJoinRequestNotificationToManagers } from '@lib/email/joinRequestNotifications';

const JoinQuerySchema = z.object({ code: z.string().trim().min(1).max(64) });

/** 10 attempts per user and minute (burst 10). */
const joinRateLimiter = new TokenBucketRateLimiter({ capacity: 10, refillPerSecond: 10 / 60 });

const invalidCode = () => new ApiError(400, 'INVALID_JOIN_CODE', 'The join code is invalid, expired or already used');

type JoinResult =
  | { type: 'joined'; result: { workspaceId: string; userId: string; role: Role } }
  | { type: 'requested'; result: { workspaceId: string; userId: string; date: Date } };

async function joinWithCode(code: string, user: User): Promise<JoinResult> {
  return runTx(async (tx) => {
    const joinCode = await tx.workspaceJoinCode.findUnique({ where: { code } });
    if (!joinCode) throw invalidCode();
    const { workspaceId } = joinCode;

    const membership = await tx.workspaceUser.findUnique({ where: { workspaceId_userId: { workspaceId, userId: user.id } }, select: { role: true } });
    if (membership) throw new ApiError(400, 'ALREADY_IN_WORKSPACE', 'You are already a member of this workspace');

    const now = new Date();
    if (joinCode.expires && joinCode.expires <= now) throw invalidCode();

    if ((await tx.workspaceUser.count({ where: { workspaceId } })) === 0) {
      // Serialize concurrent first joins so an empty workspace gets exactly one owner.
      await lockWorkspaceScope(tx, workspaceId, 'membership');
      if ((await tx.workspaceUser.count({ where: { workspaceId } })) === 0) {
        const { count } = await tx.workspaceJoinCode.deleteMany({ where: { workspaceId, code } });
        if (count === 0) throw invalidCode();
        const result = await tx.workspaceUser.create({
          data: { userId: user.id, workspaceId, role: Role.OWNER },
          select: { workspaceId: true, userId: true, role: true },
        });
        return { type: 'joined', result };
      }
    }

    const existingRequest = await tx.workspaceJoinRequest.findUnique({ where: { userId_workspaceId: { userId: user.id, workspaceId } } });
    if (existingRequest) throw new ApiError(400, 'JOIN_ALREADY_REQUESTED', 'You have already requested to join this workspace');

    const { count } = await tx.workspaceJoinCode.updateMany({
      where: {
        workspaceId,
        code,
        OR: [{ expires: null }, { expires: { gt: now } }],
        ...(joinCode.onlyUseOnce ? { used: 0 } : {}),
      },
      data: { used: { increment: 1 } },
    });
    if (count === 0) throw invalidCode();

    const result = await tx.workspaceJoinRequest.create({
      data: { userId: user.id, workspaceId },
      select: { workspaceId: true, userId: true, date: true },
    });
    return { type: 'requested', result };
  });
}

export default withHttpMethods({
  [HTTPMethod.POST]: withAuthentication(async (req: NextApiRequest, res: NextApiResponse, user: User) => {
    const parsed = JoinQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendFail(res, 400, 'VALIDATION_ERROR', 'Invalid request query', parsed.error.issues);
    }

    const limit = joinRateLimiter.take(`join:${user.id}`);
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      return sendFail(res, 429, 'RATE_LIMITED', 'Too many join attempts, please try again later');
    }

    // ApiErrors and Prisma errors are mapped to error envelopes by withHttpMethods.
    const joined = await joinWithCode(parsed.data.code, user);
    sendOk(res, joined.result);

    if (joined.type === 'requested') {
      sendJoinRequestNotificationToManagers(joined.result.workspaceId, joined.result.userId).catch((err) =>
        console.error('[join] Failed to send notification emails', err),
      );
    }
  }),
});
