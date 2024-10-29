import { builder } from '../builder';
import prisma from '../../prisma/prisma';
import { NotLoggedInError, NotPermittedError } from '../errors';
import { isUserPermitted } from '../../lib/AuthUtils';

builder.prismaObject('Glass', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name', { nullable: false }),
    volume: t.exposeFloat('volume', { nullable: true }), // in ml
    deposit: t.exposeFloat('deposit', { nullable: false }), // in €

    imageUrl: t.string({
      resolve: async (parent, _args, _ctx, _info) => {
        const glassImage = await prisma.glassImage.findFirst({ where: { glassId: parent.id } });
        return glassImage ? `/api/workspaces/${parent.workspaceId}/glasses/${parent.id}/image` : null;
      },
    }),
  }),
});

builder.queryField('glasses', (t) =>
  t.prismaField({
    type: ['Glass'],
    args: {
      workspaceId: t.arg.id({ required: true }),
    },
    resolve: async (query, _parent, _args, _ctx, _info) => {
      const user = (await _ctx).user;
      if (!user) {
        throw NotLoggedInError;
      }
      return prisma.glass.findMany({ ...query, where: { workspaceId: _args.workspaceId } });
    },
  }),
);

builder.queryField('glass', (t) =>
  t.prismaField({
    type: 'Glass',
    args: {
      id: t.arg.id({ required: true }),
    },
    resolve: async (query, _parent, _args, _ctx, _info) => {
      const user = (await _ctx).user;
      if (!user) {
        throw NotLoggedInError;
      }

      const glass = await prisma.glass.findFirst({ where: { id: _args.id } });
      // Check if user is permitted to see this entity
      if (
        (await prisma.workspaceUser.findUnique({
          where: {
            workspaceId_userId: {
              userId: user.id,
              workspaceId: glass?.workspaceId ?? '',
            },
          },
        })) == null
      ) {
        throw NotPermittedError;
      }

      return glass;
    },
  }),
);

builder.mutationField('createGlass', (t) =>
  t.prismaField({
    type: 'Glass',
    args: {
      name: t.arg.string({ required: true }),
      deposit: t.arg.float({ required: true }),
      volume: t.arg.float({ required: false }),
      workspaceId: t.arg.id({ required: true }),
    },
    resolve: async (query, _parent, _args, _ctx, _info) => {
      const user = (await _ctx).user;
      if (!user) {
        throw NotLoggedInError;
      }

      const userWorkspace = await prisma.workspaceUser.findUnique({
        where: {
          workspaceId_userId: {
            userId: user.id,
            workspaceId: _args.workspaceId,
          },
        },
      });

      if (isUserPermitted(userWorkspace?.role, 'MANAGER')) {
        throw NotPermittedError;
      }

      return prisma.glass.create({
        data: {
          name: _args.name,
          deposit: _args.deposit,
          volume: _args.volume,
          workspaceId: _args.workspaceId,
        },
      });
    },
  }),
);
