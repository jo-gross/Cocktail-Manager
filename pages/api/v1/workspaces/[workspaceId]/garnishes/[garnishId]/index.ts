// v1 canonical route — thin re-export. Path is defined by this file's location.
export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };
export { itemHandler as default } from '@lib/api/v1/garnishes';
