import { Role } from '@generated/prisma/client';
import { defineTour } from '../defineTour';

const BAR_ROUTE = '/workspaces/[workspaceId]';

export const basicsBarTour = defineTour({
  id: 'basics-bar',
  version: 1,
  category: 'basics',
  minRole: Role.USER,
  title: 'basicsBar.title',
  description: 'basicsBar.description',
  steps: [
    {
      id: 'welcome',
      kind: 'info',
      route: BAR_ROUTE,
      title: 'basicsBar.steps.welcome.title',
      body: 'basicsBar.steps.welcome.body',
    },
    {
      id: 'cardSelection',
      kind: 'highlight',
      target: 'bar.cardSelection',
      prepare: 'bar.openViewOptions',
      placement: 'left',
      title: 'basicsBar.steps.cardSelection.title',
      body: 'basicsBar.steps.cardSelection.body',
    },
    {
      id: 'search',
      prepare: 'bar.expandMenu',
      kind: 'highlight',
      target: 'bar.search',
      optional: true,
      title: 'basicsBar.steps.search.title',
      body: 'basicsBar.steps.search.body',
    },
    {
      id: 'cocktailCard',
      kind: 'highlight',
      target: 'bar.cocktailCard',
      optional: true,
      title: 'basicsBar.steps.cocktailCard.title',
      body: 'basicsBar.steps.cocktailCard.body',
    },
    {
      id: 'addToQueue',
      kind: 'highlight',
      target: 'bar.addToQueue',
      optional: true,
      title: 'basicsBar.steps.addToQueue.title',
      body: 'basicsBar.steps.addToQueue.body',
    },
    {
      id: 'queue',
      kind: 'highlight',
      target: 'bar.queue',
      optional: true,
      title: 'basicsBar.steps.queue.title',
      body: 'basicsBar.steps.queue.body',
    },
    {
      id: 'viewOptions',
      prepare: 'bar.expandMenu',
      kind: 'highlight',
      target: 'bar.viewOptions',
      title: 'basicsBar.steps.viewOptions.title',
      body: 'basicsBar.steps.viewOptions.body',
    },
    {
      id: 'manage',
      prepare: 'bar.expandMenu',
      kind: 'action',
      target: 'bar.manageLink',
      advanceOn: 'click',
      optional: true,
      title: 'basicsBar.steps.manage.title',
      body: 'basicsBar.steps.manage.body',
    },
  ],
});
