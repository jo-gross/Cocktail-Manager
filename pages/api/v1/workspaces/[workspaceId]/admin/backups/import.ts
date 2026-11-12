// v1 canonical route — thin re-export. Path is defined by this file's location.
export const config = { api: { bodyParser: { sizeLimit: '500mb' } } };
export { default } from '@lib/backup/importHandler';
