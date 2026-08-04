// v1 canonical route — thin re-export. Path is defined by this file's location.
// The exportData payload (with base64 images) can be large, so raise the limit.
export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

export { importJsonHandler as default } from '@lib/api/v1/cocktails';
