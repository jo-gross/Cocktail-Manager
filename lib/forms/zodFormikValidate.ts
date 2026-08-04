import type { ZodType } from 'zod';
import { set } from 'lodash';

/**
 * Adapts a zod schema into a Formik `validate` function: parses the form values
 * and maps each zod issue onto Formik's (possibly nested) error object via the
 * issue path. Returns `{}` when the values are valid.
 *
 * Nested paths (e.g. `steps[0].amount`) are supported through lodash `set`,
 * matching Formik's nested-error shape.
 */
export function zodFormikValidate<T>(schema: ZodType<T>) {
  return (values: unknown): Record<string, unknown> => {
    const result = schema.safeParse(values);
    if (result.success) return {};

    const errors: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      if (issue.path.length > 0) {
        set(errors, issue.path as Array<string | number>, issue.message);
      }
    }
    return errors;
  };
}
