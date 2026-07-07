// v1 canonical route — thin re-export. Path is defined by this file's location.
// Base64 images can make PUT bodies large, so raise the body-parser limit.
export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

export { itemHandler as default } from '@lib/api/v1/cocktails';
