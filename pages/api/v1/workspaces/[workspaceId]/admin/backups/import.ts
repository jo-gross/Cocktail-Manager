// v1 canonical route — thin re-export. Path is defined by this file's location.
// Backups embed all images as base64; 100 MB covers large bars (see docs/ENV.md "Backups").
export const config = { api: { bodyParser: { sizeLimit: '100mb' } } };
export { default } from '@lib/backup/importHandler';
