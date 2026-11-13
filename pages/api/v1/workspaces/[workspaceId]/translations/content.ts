// v1 canonical route — thin re-export. Path is defined by this file's location.
export { contentTranslationsHandler as default } from '@lib/api/v1/contentTranslations';

// A CSV import sends all rows (up to 20 000 items) in one request.
export const config = { api: { bodyParser: { sizeLimit: '5mb' } } };
