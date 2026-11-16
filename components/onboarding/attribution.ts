/** Image credit of a template item (`imageCredit` of `/templates/{key}/items`); cards have none. */
export function itemImageCredit(item: object): string | null {
  const credit = (item as { imageCredit?: unknown }).imageCredit;
  return typeof credit === 'string' && credit.trim() !== '' ? credit : null;
}
