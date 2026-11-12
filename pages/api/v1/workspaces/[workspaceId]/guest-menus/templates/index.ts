// v1 canonical route — thin re-export. Template definitions may carry a theme with inline images → raise the body limit.
export { templatesCollectionHandler as default } from '@lib/api/v1/guestMenus';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
