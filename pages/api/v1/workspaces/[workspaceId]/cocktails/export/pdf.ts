// v1 canonical route — thin re-export. Path is defined by this file's location.
// Options bodies can be sizeable and the response is a (potentially large) PDF.
export const config = { api: { bodyParser: { sizeLimit: '20mb' }, responseLimit: '200mb' } };

export { exportPdfHandler as default } from '@lib/api/v1/cocktails';
