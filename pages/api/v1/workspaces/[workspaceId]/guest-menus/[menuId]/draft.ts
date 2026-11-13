// v1 canonical route — thin re-export. Drafts carry inline images (logo, background, image blocks) → raise the body limit.
export { draftHandler as default } from '@lib/api/v1/guestMenus';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
