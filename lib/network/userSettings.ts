import { alertService } from '@lib/alertService';
import { apiV1Mutate } from '@lib/network/apiV1';
import type { UserSettingDto, UserSettingUpdateInput } from '@lib/schemas/userSettings';

export function upsertUserSettingRequest(body: UserSettingUpdateInput): Promise<UserSettingDto> {
  return apiV1Mutate<UserSettingDto>('/api/v1/users/settings', 'PUT', body);
}

export async function upsertUserSettingSafe(
  body: UserSettingUpdateInput,
  errorMessage = 'Failed to update user settings',
): Promise<UserSettingDto | undefined> {
  try {
    return await upsertUserSettingRequest(body);
  } catch (error) {
    console.error('upsertUserSettingSafe', error);
    alertService.error(errorMessage);
    return undefined;
  }
}
