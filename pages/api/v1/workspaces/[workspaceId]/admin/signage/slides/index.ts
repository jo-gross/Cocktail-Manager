// v1 canonical route — thin re-export. Slide uploads are base64 → raise the body limit.
export { slidesHandler as default } from '@lib/api/v1/signage';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};
