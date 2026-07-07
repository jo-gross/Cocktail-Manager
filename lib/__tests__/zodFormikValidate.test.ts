import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { zodFormikValidate } from '../forms/zodFormikValidate';

describe('zodFormikValidate', () => {
  const schema = z.object({
    name: z.string().min(1, 'Required'),
    steps: z.array(z.object({ amount: z.number('Zahl erforderlich') })),
  });
  const validate = zodFormikValidate(schema);

  it('returns {} for valid values', () => {
    expect(validate({ name: 'Old Fashioned', steps: [{ amount: 4 }] })).toEqual({});
  });

  it('maps top-level errors by field name', () => {
    const errors = validate({ name: '', steps: [] }) as { name?: string };
    expect(errors.name).toBe('Required');
  });

  it('maps nested array errors into Formik shape', () => {
    const errors = validate({ name: 'x', steps: [{ amount: 'nope' }] }) as { steps?: Array<{ amount?: string }> };
    expect(errors.steps?.[0]?.amount).toBeTruthy();
  });
});
