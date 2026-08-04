// v1 canonical route — thin re-export. Path is defined by this file's location.
// Export dumps can be large, so raise the body-parser limit.
export const config = { api: { bodyParser: { sizeLimit: '20mb' } } };

export { importJsonHandler as default } from '@lib/api/v1/calculations';
