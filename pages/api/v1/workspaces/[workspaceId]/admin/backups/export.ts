// v1 canonical route — thin re-export. Path is defined by this file's location.
export const config = { api: { responseLimit: false } };
export { default } from '@lib/backup/exportHandler';
