import { builder } from '../builder';
import prisma from '../../prisma/prisma';
import { GraphQLError } from 'graphql/error';

builder.prismaObject('Workspace', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name', { nullable: false }),
    description: t.exposeString('description', { nullable: true }),
    image: t.exposeString('image', { nullable: true }),
    users: t.relation('users'),
  }),
});

builder.queryField('workspaces', (t) =>
  t.prismaField({
    type: ['Workspace'],

    resolve: async (query, _parent, _args, _ctx, _info) => {
      const user = (await _ctx).user;
      if (!user) {
        throw new GraphQLError('You have to be logged in to see workspaces');
      }
      return prisma.workspace.findMany({ ...query, where: { users: { some: { userId: user.id } } } });
    },
  }),
);
