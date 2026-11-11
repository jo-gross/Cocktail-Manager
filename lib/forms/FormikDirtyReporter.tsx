import { useMemo } from 'react';
import { useFormikContext } from 'formik';
import { isFormDirty } from './formDirty';
import { useReportUnsavedChanges } from './useUnsavedChanges';

interface FormikDirtyReporterProps<Values> {
  /**
   * Maps the form values to what is actually persisted (mirror `onSubmit`): drop UI-only / derived
   * fields (display objects enriched after load, temporary state, original image files) and trim
   * where the submit trims. Should be a stable (module-level) function.
   */
  toComparable: (values: Values) => unknown;
}

/**
 * Reports whether a Formik form differs from its initial values (reset via `resetForm` / `enableReinitialize`)
 * to the surrounding page's leave guard. Render it inside `<Formik>`.
 *
 * Formik's own `dirty` flag is not used on purpose: it compares raw values, so display data that is
 * enriched after mount (or numbers typed as strings, `null` vs `''`) would count as a change.
 */
export function FormikDirtyReporter<Values>({ toComparable }: FormikDirtyReporterProps<Values>) {
  const { values, initialValues } = useFormikContext<Values>();
  const dirty = useMemo(() => isFormDirty(toComparable(values), toComparable(initialValues)), [values, initialValues, toComparable]);
  useReportUnsavedChanges(dirty);
  return null;
}
