// v1 canonical route — thin re-export. The initial draft may carry inline images → raise the body limit.
export { collectionHandler as default } from '@lib/api/v1/guestMenus';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
