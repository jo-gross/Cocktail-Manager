import { describe, expect, it } from 'vitest';
import { remapGuestMenuDocumentIds } from '../backup';
import { createDefaultGuestMenuDocument, parseGuestMenuDocument } from '../schema';

describe('remapGuestMenuDocumentIds', () => {
  it('rewrites cocktail, ingredient, group and template references', () => {
    const doc = createDefaultGuestMenuDocument({ withCardSection: false });
    doc.templates.web = { templateId: 'custom:t-old' };
    doc.blocks.push(
      {
        id: 's1',
        type: 'section',
        title: {},
        source: { kind: 'manual', cocktailIds: ['c-old', 'c-missing'] },
        overrides: { 'c-old': { highlight: 'new' }, 'c-missing': { hidden: true } },
      },
      { id: 's2', type: 'section', title: {}, source: { kind: 'rule', tags: ['x'], ingredientIds: ['i-old'], logic: 'OR', sort: 'name' }, overrides: {} },
      { id: 's3', type: 'section', title: {}, source: { kind: 'cardGroup', groupId: 'g-old' }, overrides: {} },
    );
    const result = remapGuestMenuDocumentIds(doc, {
      cocktails: new Map([['c-old', 'c-new']]),
      ingredients: new Map([['i-old', 'i-new']]),
      cardGroups: new Map([['g-old', 'g-new']]),
      templates: new Map([['t-old', 't-new']]),
    });
    expect(() => parseGuestMenuDocument(result)).not.toThrow();
    const [s1, s2, s3] = result.blocks.slice(-3);
    expect(s1.type === 'section' && s1.source).toEqual({ kind: 'manual', cocktailIds: ['c-new'] });
    expect(s1.type === 'section' && s1.overrides).toEqual({ 'c-new': { highlight: 'new' } });
    expect(s2.type === 'section' && s2.source.kind === 'rule' && s2.source.ingredientIds).toEqual(['i-new']);
    expect(s3.type === 'section' && s3.source.kind === 'cardGroup' && s3.source.groupId).toBe('g-new');
    expect(result.templates.web.templateId).toBe('custom:t-new');
    expect(doc.templates.web.templateId).toBe('custom:t-old');
  });
});
