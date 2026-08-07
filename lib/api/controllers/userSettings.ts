/**
 * Version-agnostic business logic for session user settings (v1).
 */
import type { Setting, User } from '@generated/prisma/client';
import prisma from '../../../prisma/prisma';
import type { UserSettingDto, UserSettingUpdateInput } from '@lib/schemas/userSettings';

export async function upsertUserSetting(user: User, input: UserSettingUpdateInput): Promise<UserSettingDto> {
  const setting = input.setting as Setting;
  const row = await prisma.userSetting.upsert({
    where: {
      userId_setting: {
        userId: user.id,
        setting,
      },
    },
    create: {
      userId: user.id,
      setting,
      value: input.value,
    },
    update: {
      value: input.value,
    },
  });

  return {
    userId: row.userId,
    setting: row.setting,
    value: row.value,
  };
}
