import { Role } from '@prisma/client';

export function isUserPermitted(role: string | undefined, minRole: Role) {
  if (!role) {
    return false;
  }

  if (role === Role.OWNER) {
    return true;
  }
  if (role === Role.ADMIN) {
    return minRole !== Role.OWNER;
  }
  if (role === Role.MANAGER) {
    return minRole === Role.USER;
  }
  return minRole === Role.USER;
}
