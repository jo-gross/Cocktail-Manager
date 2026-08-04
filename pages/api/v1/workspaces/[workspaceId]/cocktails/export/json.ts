// v1 canonical route — thin re-export. Path is defined by this file's location.
// The export dump can be large (base64 images), so raise the body-parser limit.
export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

export { exportJsonHandler as default } from '@lib/api/v1/cocktails';
