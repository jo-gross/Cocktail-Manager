import SchemaBuilder from '@pothos/core';
import PrismaPlugin from '@pothos/plugin-prisma';
import prisma from '../prisma/prisma';
import RelayPlugin from '@pothos/plugin-relay';
import ScopeAuthPlugin from '@pothos/plugin-scope-auth';

import { createContext } from './context';
import PrismaTypes from '@pothos/plugin-prisma/generated';

type MyPerms = 'readStuff' | 'updateStuff' | 'readArticle';

export const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypes;
  Context: ReturnType<typeof createContext>;
  AuthScopes: {
    employee: boolean;
    deferredScope: boolean;
    customPerm: MyPerms;
  };
}>({
  plugins: [PrismaPlugin, RelayPlugin, ScopeAuthPlugin],
  relayOptions: {},
  prisma: {
    client: prisma,
  },
});

builder.queryType({
  fields: (t) => ({
    ok: t.boolean({
      resolve: () => true,
    }),
  }),
});
