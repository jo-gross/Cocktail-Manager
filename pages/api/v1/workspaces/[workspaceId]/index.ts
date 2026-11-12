// v1 canonical route — thin re-export. Path is defined by this file's location.
export { itemHandler as default } from '@lib/api/v1/workspace';

// PUT carries the workspace logo as a data URI (ImageDataUriSchema, ≤ 10 MB).
export const config = { api: { bodyParser: { sizeLimit: '12mb' } } };
