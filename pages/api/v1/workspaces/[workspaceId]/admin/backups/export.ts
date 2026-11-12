// v1 canonical route — thin re-export. Path is defined by this file's location.
// The export contains all images and may exceed Next's 4 MB response warning limit.
export const config = { api: { responseLimit: false } };
export { default } from '@lib/backup/exportHandler';
