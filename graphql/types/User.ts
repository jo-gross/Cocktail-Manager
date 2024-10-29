import { builder } from '../builder';
import prisma from '../../prisma/prisma';
import { NotLoggedInError } from '../errors';

builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name', { nullable: true }),
    email: t.exposeString('email', { nullable: true }),
    image: t.exposeString('image', { nullable: true }),
  }),
});

builder.queryField('me', (t) =>
  t.prismaField({
    type: 'User',

    resolve: async (query, _parent, _args, _ctx, _info) => {
      const user = (await _ctx).user;
      if (!user) {
        throw NotLoggedInError;
      }
      return prisma.user.findFirst({ ...query, where: { id: user.id } });
    },
  }),
);
