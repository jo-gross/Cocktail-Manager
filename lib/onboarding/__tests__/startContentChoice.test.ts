import { describe, expect, it } from 'vitest';
import { emptyTemplateSelection } from '../templateSelection';
import { effectiveStartContentChoice, selectionCount, startContentAction, type StartContentChoice } from '../startContentChoice';

const classics: StartContentChoice = { kind: 'template', key: 'classics', mode: 'all', selection: emptyTemplateSelection() };

describe('effectiveStartContentChoice', () => {
  it('chooses the first collection on a first start', () => {
    expect(effectiveStartContentChoice(null, ['classics', 'tiki'], 0, emptyTemplateSelection)).toEqual(classics);
  });

  it('chooses "nothing more" once something was applied', () => {
    expect(effectiveStartContentChoice(null, ['classics'], 1, emptyTemplateSelection)).toEqual({ kind: 'empty' });
  });

  it('starts empty when no collection is offered', () => {
    expect(effectiveStartContentChoice(null, [], 0, emptyTemplateSelection)).toEqual({ kind: 'empty' });
  });

  it('keeps an explicit choice, unless its collection is not offered (other content language)', () => {
    expect(effectiveStartContentChoice({ kind: 'empty' }, ['classics'], 0, emptyTemplateSelection)).toEqual({ kind: 'empty' });
    const tiki: StartContentChoice = { ...classics, key: 'tiki', mode: 'basics' };
    expect(effectiveStartContentChoice(tiki, ['classics', 'tiki'], 0, emptyTemplateSelection)).toBe(tiki);
    expect(effectiveStartContentChoice(tiki, ['classics'], 0, emptyTemplateSelection)).toEqual(classics);
  });
});

describe('startContentAction', () => {
  it('applies a chosen collection – also again after it was applied', () => {
    expect(startContentAction(classics, 0)).toEqual({ kind: 'apply', key: 'classics', mode: 'all', count: 0 });
    expect(startContentAction(classics, 1)).toEqual({ kind: 'apply', key: 'classics', mode: 'all', count: 0 });
  });

  it('counts the picked items of a selection', () => {
    const selection = { ...emptyTemplateSelection(), cocktails: ['a', 'b'], glasses: ['g'] };
    expect(selectionCount(selection)).toBe(3);
    expect(startContentAction({ ...classics, mode: 'selection', selection }, 0)).toEqual({ kind: 'apply', key: 'classics', mode: 'selection', count: 3 });
  });

  it('is an explicit empty start without applied content and a plain "next" afterwards', () => {
    expect(startContentAction({ kind: 'empty' }, 0)).toEqual({ kind: 'empty' });
    expect(startContentAction({ kind: 'empty' }, 2)).toEqual({ kind: 'next' });
  });
});
