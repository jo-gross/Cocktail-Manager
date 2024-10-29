import { builder } from '../builder';

builder.prismaObject('WorkspaceUser', {
  fields: (t) => ({
    user: t.relation('user', { nullable: false }),
    role: t.expose('role', { type: Role }),
  }),
});

const Role = builder.enumType('Role', {
  values: ['USER', 'ADMIN', 'MANAGER', 'OWNER'] as const,
});
