import { compareAnnouncements, isAnnouncementLevel, isDismissible, pickAnnouncementText, readStoredAnnouncementText } from '@lib/announcements/text';

describe('isAnnouncementLevel', () => {
  it('accepts exactly the three lowercase levels', () => {
    expect(['info', 'warning', 'critical'].every(isAnnouncementLevel)).toBe(true);
    for (const value of ['INFO', 'Critical', ' info', 'error', '', null, 1]) expect(isAnnouncementLevel(value), String(value)).toBe(false);
  });
});

describe('pickAnnouncementText', () => {
  const text = { de: 'Wartung', en: 'Maintenance' };

  it('picks the UI language and English for unknown ones', () => {
    expect(pickAnnouncementText(text, 'de')).toBe('Wartung');
    expect(pickAnnouncementText(text, 'de-AT')).toBe('Wartung');
    expect(pickAnnouncementText(text, 'en')).toBe('Maintenance');
    expect(pickAnnouncementText(text, 'fr')).toBe('Maintenance');
    expect(pickAnnouncementText(text, undefined)).toBe('Maintenance');
  });
});

describe('readStoredAnnouncementText', () => {
  it('reads stored texts and rejects other values', () => {
    expect(readStoredAnnouncementText({ de: 'a', en: 'b' })).toEqual({ de: 'a', en: 'b' });
    expect(readStoredAnnouncementText({ en: 'b' })).toBeNull();
    expect(readStoredAnnouncementText({ de: '', en: 'b' })).toBeNull();
    expect(readStoredAnnouncementText({ de: 1, en: 'b' })).toBeNull();
    expect(readStoredAnnouncementText(null)).toBeNull();
    expect(readStoredAnnouncementText('text')).toBeNull();
    expect(readStoredAnnouncementText({})).toBeNull();
  });
});

describe('order and dismissal rule', () => {
  it('sorts the most severe first, then by id', () => {
    const sorted = [
      { id: 'b', level: 'info' as const },
      { id: 'c', level: 'critical' as const },
      { id: 'a', level: 'info' as const },
      { id: 'd', level: 'warning' as const },
    ].sort(compareAnnouncements);
    expect(sorted.map((item) => item.id)).toEqual(['c', 'd', 'a', 'b']);
  });

  it('only lets info announcements be dismissed', () => {
    expect(isDismissible('info')).toBe(true);
    expect(isDismissible('warning')).toBe(false);
    expect(isDismissible('critical')).toBe(false);
  });
});
