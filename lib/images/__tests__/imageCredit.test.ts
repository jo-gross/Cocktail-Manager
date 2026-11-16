import { describe, expect, it } from 'vitest';
import { imageCreditUrl, nextImageCredit, normalizeImageCredit, shortImageCredit } from '@lib/images/imageCredit';

const COMMONS =
  '"Whiskey Sour" by Jgilgamesh, https://commons.wikimedia.org/wiki/File:Whiskey_Sour.jpg, CC BY-SA 3.0 https://creativecommons.org/licenses/by-sa/3.0/, scaled';

describe('image credits', () => {
  it('shortens credits to author and license', () => {
    expect(shortImageCredit(COMMONS)).toBe('Jgilgamesh · CC BY-SA 3.0');
    expect(shortImageCredit('"Whiskey Old Fashioned1" © Erich Wagner (www.eventografie.de), https://x.org/a.jpg, CC BY-SA 4.0 https://x')).toBe(
      'Erich Wagner (www.eventografie.de) · CC BY-SA 4.0',
    );
    expect(shortImageCredit('Glass illustrations by Will Murray (Willscrlt), http://willmurray.name, via Wikimedia Commons, CC0 1.0')).toBe(
      'Will Murray (Willscrlt) · CC0 1.0',
    );
    expect(shortImageCredit('Foto: Max Muster')).toBe('Foto: Max Muster');
    expect(shortImageCredit('x'.repeat(100))).toHaveLength(60);
  });

  it('finds the source URL', () => {
    expect(imageCreditUrl(COMMONS)).toBe('https://commons.wikimedia.org/wiki/File:Whiskey_Sour.jpg');
    expect(imageCreditUrl('Foto: Max Muster')).toBeNull();
    expect(imageCreditUrl('javascript:alert(1)')).toBeNull();
  });

  it('normalizes whitespace and empty values', () => {
    expect(normalizeImageCredit('  a \n b ')).toBe('a b');
    expect(normalizeImageCredit('   ')).toBeNull();
    expect(normalizeImageCredit(undefined)).toBeNull();
  });

  it('keeps the credit only for the same image unless one is given', () => {
    const previous = { image: 'data:a', credit: 'Old' };
    expect(nextImageCredit({ image: 'data:a' }, previous)).toBe('Old');
    expect(nextImageCredit({ image: 'data:b' }, previous)).toBeNull();
    expect(nextImageCredit({ image: 'data:b', credit: 'New' }, previous)).toBe('New');
    expect(nextImageCredit({ image: 'data:a', credit: null }, previous)).toBeNull();
    expect(nextImageCredit({ image: 'data:a', credit: '' }, previous)).toBeNull();
    expect(nextImageCredit({ image: null, credit: 'x' }, previous)).toBeNull();
    expect(nextImageCredit({ image: 'data:a' }, null)).toBeNull();
  });
});
